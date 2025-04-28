"""
Custom implementation of stdio_client that handles stderr through rich console.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import TextIO

import shutil
import subprocess
import sys

import anyio
import anyio.lowlevel
from anyio.streams.text import TextReceiveStream
from mcp.client.stdio import StdioServerParameters, get_default_environment
import mcp.types as types
from mcp_agent.logging.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def stdio_client_with_rich_stderr(
    server: StdioServerParameters, errlog: int | TextIO = subprocess.PIPE
):
    """
    Client transport for stdio: this will connect to a server by spawning a
    process and communicating with it over stdin/stdout.
    """
    read_stream_writer, read_stream = anyio.create_memory_object_stream(0)
    write_stream, write_stream_reader = anyio.create_memory_object_stream(0)

    command = _get_executable_command(server.command)

    # Open process with stderr piped for capture
    process = await _create_platform_compatible_process(
        command=command,
        args=server.args,
        env=(
            {**get_default_environment(), **server.env}
            if server.env is not None
            else get_default_environment()
        ),
        errlog=errlog,
        cwd=server.cwd,
    )

    if process.pid:
        logger.debug(f"Started process '{command}' with PID: {process.pid}")

    if process.returncode is not None:
        logger.debug(f"return code (early){process.returncode}")
        raise RuntimeError(
            f"Process terminated immediately with code {process.returncode}"
        )

    async def stdout_reader():
        assert process.stdout, "Opened process is missing stdout"

        try:
            async with read_stream_writer:
                buffer = ""
                async for chunk in TextReceiveStream(
                    process.stdout,
                    encoding=server.encoding,
                    errors=server.encoding_error_handler,
                ):
                    lines = (buffer + chunk).split("\n")
                    buffer = lines.pop()

                    for line in lines:
                        try:
                            message = types.JSONRPCMessage.model_validate_json(line)
                        except Exception as exc:
                            await read_stream_writer.send(exc)
                            continue

                        await read_stream_writer.send(message)
        except anyio.ClosedResourceError:
            await anyio.lowlevel.checkpoint()
        except Exception as e:
            logger.error(f"Error in stdout_reader: {e}")

    async def stderr_reader():
        assert process.stderr, "Opened process is missing stderr"
        try:
            async for chunk in TextReceiveStream(
                process.stderr,
                encoding=server.encoding,
                errors=server.encoding_error_handler,
            ):
                if chunk.strip():
                    # Let the logging system handle the formatting consistently
                    try:
                        logger.event(
                            "info", "mcpserver.stderr", chunk.rstrip(), None, {}
                        )
                    except Exception as e:
                        logger.error(
                            f"Error in stderr_reader handling output: {e}",
                            exc_info=True,
                        )
        except anyio.ClosedResourceError:
            await anyio.lowlevel.checkpoint()
        except Exception as e:
            logger.error(f"Unexpected error in stderr_reader: {e}", exc_info=True)

    async def stdin_writer():
        assert process.stdin, "Opened process is missing stdin"

        try:
            async with write_stream_reader:
                async for message in write_stream_reader:
                    json = message.model_dump_json(by_alias=True, exclude_none=True)
                    data = (json + "\n").encode(
                        encoding=server.encoding, errors=server.encoding_error_handler
                    )

                    await process.stdin.send(data)
        except anyio.ClosedResourceError:
            await anyio.lowlevel.checkpoint()
        except Exception as e:
            logger.error(f"Error in stdin_writer: {e}")

    async with (
        anyio.create_task_group() as tg,
        process,
    ):
        tg.start_soon(stdout_reader)
        tg.start_soon(stdin_writer)
        tg.start_soon(stderr_reader)
        try:
            yield read_stream, write_stream
        finally:
            # Clean up process
            logger.debug(
                f"Terminating process (PID: {process.pid if hasattr(process, 'pid') else 'unknown'})"
            )
            try:
                process.terminate()
                if sys.platform == "win32":
                    try:
                        with anyio.fail_after(2.0):
                            await process.wait()
                    except TimeoutError:
                        # Force kill if it doesn't terminate
                        process.kill()
            except Exception as e:
                logger.warning(
                    f"Error terminating process (PID: {process.pid if hasattr(process, 'pid') else 'unknown'}): {e}"
                )


def _get_executable_command(command: str) -> str:
    """
    Get the correct executable command normalized for the current platform.

    Args:
        command: Base command (e.g., 'uvx', 'npx')

    Returns:
        str: Platform-appropriate command
    """

    try:
        if sys.platform != "win32":
            return command
        else:
            # For Windows, we need more sophisticated path resolution
            # First check if command exists in PATH as-is
            command_path = shutil.which(command)
            if command_path:
                return command_path

            # Check for Windows-specific extensions
            for ext in [".cmd", ".bat", ".exe", ".ps1"]:
                ext_version = f"{command}{ext}"
                ext_path = shutil.which(ext_version)
                if ext_path:
                    return ext_path

            # For regular commands or if we couldn't find special versions
            return command
    except Exception:
        return command


async def _create_platform_compatible_process(
    command: str,
    args: list[str],
    env: dict[str, str] | None = None,
    errlog: int | TextIO = subprocess.PIPE,
    cwd: Path | str | None = None,
):
    """
    Creates a subprocess in a platform-compatible way.
    Returns a process handle.
    """

    process = None

    if sys.platform == "win32":
        try:
            process = await anyio.open_process(
                [command, *args],
                env=env,
                # Ensure we don't create console windows for each process
                creationflags=subprocess.CREATE_NO_WINDOW  # type: ignore
                if hasattr(subprocess, "CREATE_NO_WINDOW")
                else 0,
                stderr=errlog,
                cwd=cwd,
            )

            return process
        except Exception:
            # Don't raise, let's try to create the process using the default method
            process = None

    # Default method for creating the process
    process = await anyio.open_process(
        [command, *args], env=env, stderr=errlog, cwd=cwd
    )

    return process
