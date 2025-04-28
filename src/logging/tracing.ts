/**
 * Telemetry manager that defines distributed tracing decorators for OpenTelemetry traces/spans
 * for the Logger module for MCP Agent
 */

import { trace, SpanKind, SpanStatusCode, Span, context, Context as OtelContext } from '@opentelemetry/api';
import { TraceContextTextMapPropagator } from '@opentelemetry/core';
import { ContextDependent } from '../context_dependent.js';
import { Context } from '../context.js';

export class TelemetryManager extends ContextDependent {
  /**
   * Simple manager for creating OpenTelemetry spans automatically.
   * Decorator usage: @telemetry.traced("SomeSpanName")
   */

  constructor(context?: Context, ...args: any[]) {
    // If needed, configure resources, exporters, etc.
    // E.g.: from opentelemetry.sdk.trace import TracerProvider
    // trace.set_tracer_provider(TracerProvider(...))
    super({ context, ...args });
  }

  traced(
    name?: string,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes?: Record<string, any>
  ): Function {
    /**
     * Decorator that automatically creates and manages a span for a function.
     * Works for both async and sync functions.
     */

    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
      const originalMethod = descriptor?.value;
      if (!originalMethod) return target;

      const spanName = name || `${target.constructor.name}.${propertyKey}`;
      const tracer = this.context.tracer || trace.getTracer('mcp_agent');

      descriptor.value = async function(...args: any[]) {
        const span = tracer.startSpan(spanName, { kind });

        if (attributes) {
          for (const [k, v] of Object.entries(attributes)) {
            span.setAttribute(k, v);
          }
        }

        // Record simple args
        recordArgs(span, args);

        return await context.with(trace.setSpan(context.active(), span), async () => {
          try {
            const result = await originalMethod.apply(this, args);
            span.end();
            return result;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
            throw error;
          }
        });
      };

      return descriptor;
    };
  }
}

function recordArgs(span: Span, args: any[]): void {
  /**
   * Optionally record primitive args as span attributes.
   */
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      span.setAttribute(`arg_${i}`, String(arg));
    }
  }
}

export class MCPRequestTrace {
  /**
   * Helper class for trace context propagation in MCP
   */

  static startSpanFromMcpRequest(
    method: string,
    params: Record<string, any>
  ): [Span, OtelContext] {
    /**
     * Extract trace context from incoming MCP request and start a new span
     */
    // Extract trace context from _meta if present
    const carrier: Record<string, string> = {};
    const _meta = params._meta || {};
    
    if (_meta.traceparent) {
      carrier['traceparent'] = _meta.traceparent;
    }
    
    if (_meta.tracestate) {
      carrier['tracestate'] = _meta.tracestate;
    }

    // Extract context and start span
    const propagator = new TraceContextTextMapPropagator();
    const ctx = propagator.extract(context.active(), carrier);
    const tracer = trace.getTracer('mcp_agent');
    
    const span = tracer.startSpan(method, {
      kind: SpanKind.SERVER
    }, ctx);
    
    return [span, trace.setSpan(ctx, span)];
  }

  static injectTraceContext(arguments_: Record<string, any>): Record<string, any> {
    /**
     * Inject current trace context into outgoing MCP request arguments
     */
    const carrier: Record<string, string> = {};
    const propagator = new TraceContextTextMapPropagator();
    propagator.inject(context.active(), carrier);

    // Create or update _meta with trace context
    const _meta = arguments_._meta || {};
    
    if (carrier.traceparent) {
      _meta.traceparent = carrier.traceparent;
    }
    
    if (carrier.tracestate) {
      _meta.tracestate = carrier.tracestate;
    }
    
    arguments_._meta = _meta;

    return arguments_;
  }
}

export const telemetry = new TelemetryManager();