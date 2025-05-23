/**
 * Orchestrator Worker Example
 * 
 * This example demonstrates how to use the Orchestrator workflow to grade a student's short story
 * using multiple specialized agents.
 */
import * as fs from 'fs';
import * as path from 'path';
import { 
  MCPApp, 
  Agent, 
  OpenAIAugmentedLLM,
  AnthropicAugmentedLLM,
  Orchestrator
} from '../../src';

/**
 * Example function to read a file
 */
async function readFile(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Example function to write a file
 */
async function writeFile(filePath: string, content: string): Promise<string> {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    fs.writeFileSync(fullPath, content, 'utf8');
    return `Successfully wrote to ${filePath}`;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Example function to fetch content from a URL
 */
async function fetchUrl(url: string): Promise<string> {
  // This is a mock implementation
  if (url.includes('apastyle.apa.org')) {
    if (url.includes('formatting')) {
      return `
        # APA Style Formatting Guidelines
        
        ## Paper Format
        - Use 8.5 x 11-inch paper
        - 1-inch margins on all sides
        - Double-space all text
        - Use a readable font (e.g., Times New Roman 12pt, Calibri 11pt, Arial 11pt)
        - Include a page number in the top right corner of each page
        
        ## Title Page
        - Title of the paper
        - Author's name
        - Institutional affiliation
        - Course number and name
        - Instructor's name
        - Due date
        
        ## Abstract
        - Begin on a new page
        - Label "Abstract" centered at the top
        - 150-250 words summarizing the key points
        
        ## Main Body
        - Begin on a new page
        - Title centered at the top
        - Use headings to organize content
        - Level 1: Centered, Bold, Title Case
        - Level 2: Left-aligned, Bold, Title Case
        - Level 3: Left-aligned, Bold Italic, Title Case
        
        ## References
        - Begin on a new page
        - Label "References" centered at the top
        - Double-space all entries
        - Use hanging indent format
      `;
    } else if (url.includes('references')) {
      return `
        # APA Style References Guidelines
        
        ## Basic Format
        - Author, A. A. (Year). Title of work. Publisher.
        
        ## Journal Article
        - Author, A. A., & Author, B. B. (Year). Title of article. Title of Journal, volume(issue), page range. DOI or URL
        
        ## Book
        - Author, A. A. (Year). Title of book. Publisher.
        
        ## Book Chapter
        - Author, A. A. (Year). Title of chapter. In E. E. Editor (Ed.), Title of book (pp. page range). Publisher.
        
        ## Website
        - Author, A. A. (Year, Month Day). Title of page. Site Name. URL
        
        ## In-text Citations
        - One author: (Smith, 2020)
        - Two authors: (Smith & Jones, 2020)
        - Three or more authors: (Smith et al., 2020)
        - Direct quote: (Smith, 2020, p. 45)
      `;
    }
  }
  
  return `Mock content for ${url}`;
}

/**
 * Main function
 */
async function main() {
  // Create app
  const app = new MCPApp({
    name: 'assignment-grader-orchestrator',
  });
  
  // Run the app
  await app.run(async (app) => {
    console.log('Creating agents...');
    
    // Create specialized agents
    const finderAgent = new Agent({
      name: 'finder',
      instruction: `You are an agent with access to the filesystem, 
      as well as the ability to fetch URLs. Your job is to identify 
      the closest match to a user's request, make the appropriate tool calls, 
      and return the URI and CONTENTS of the closest match.`,
      functions: [readFile, fetchUrl],
      context: app.context,
    });
    
    const writerAgent = new Agent({
      name: 'writer',
      instruction: `You are an agent that can write to the filesystem.
      You are tasked with taking the user's input, addressing it, and 
      writing the result to disk in the appropriate location.`,
      functions: [writeFile],
      context: app.context,
    });
    
    const proofreaderAgent = new Agent({
      name: 'proofreader',
      instruction: `Review the short story for grammar, spelling, and punctuation errors.
      Identify any awkward phrasing or structural issues that could improve clarity. 
      Provide detailed feedback on corrections.`,
      functions: [fetchUrl],
      context: app.context,
    });
    
    const factCheckerAgent = new Agent({
      name: 'fact_checker',
      instruction: `Verify the factual consistency within the story. Identify any contradictions,
      logical inconsistencies, or inaccuracies in the plot, character actions, or setting. 
      Highlight potential issues with reasoning or coherence.`,
      functions: [fetchUrl],
      context: app.context,
    });
    
    const styleEnforcerAgent = new Agent({
      name: 'style_enforcer',
      instruction: `Analyze the story for adherence to style guidelines.
      Evaluate the narrative flow, clarity of expression, and tone. Suggest improvements to 
      enhance storytelling, readability, and engagement.`,
      functions: [fetchUrl],
      context: app.context,
    });
    
    // Initialize all agents
    await Promise.all([
      finderAgent.initialize(),
      writerAgent.initialize(),
      proofreaderAgent.initialize(),
      factCheckerAgent.initialize(),
      styleEnforcerAgent.initialize(),
    ]);
    
    // Create LLM factory function
    const llmFactory = async (agent: Agent) => {
      if (agent.name === 'finder' || agent.name === 'writer') {
        return new OpenAIAugmentedLLM({
          agent,
          model: 'gpt-4o',
        });
      } else {
        return new AnthropicAugmentedLLM({
          agent,
          model: 'claude-3-opus-20240229',
        });
      }
    };
    
    // Define the task
    const task = `Load the student's short story from short_story.md, 
    and generate a report with feedback across proofreading, 
    factuality/logical consistency and style adherence. Use the style rules from 
    https://apastyle.apa.org/learn/quick-guide-on-formatting and 
    https://apastyle.apa.org/learn/quick-guide-on-references.
    Write the graded report to graded_report.md in the same directory as short_story.md`;
    
    console.log('\n=== Running Orchestrator with Full Planning ===');
    console.log('Task:', task);
    
    // Start time measurement for full planning
    const startTimeFull = Date.now();
    
    // Create orchestrator with full planning
    const orchestratorFull = new Orchestrator({
      availableAgents: [
        finderAgent,
        writerAgent,
        proofreaderAgent,
        factCheckerAgent,
        styleEnforcerAgent,
      ],
      llmFactory,
      planType: 'full',
    });
    
    // Run the orchestrator with full planning
    const resultFull = await orchestratorFull.complete([
      { role: 'user', content: task }
    ]);
    
    // End time measurement for full planning
    const endTimeFull = Date.now();
    const executionTimeFull = (endTimeFull - startTimeFull) / 1000; // Convert to seconds
    
    console.log(`\nFull planning completed in ${executionTimeFull.toFixed(2)} seconds`);
    console.log('Result excerpt:');
    console.log(resultFull.choices[0].message.content.substring(0, 300) + '...');
    
    console.log('\n=== Running Orchestrator with Iterative Planning ===');
    console.log('Task:', task);
    
    // Start time measurement for iterative planning
    const startTimeIterative = Date.now();
    
    // Create orchestrator with iterative planning
    const orchestratorIterative = new Orchestrator({
      availableAgents: [
        finderAgent,
        writerAgent,
        proofreaderAgent,
        factCheckerAgent,
        styleEnforcerAgent,
      ],
      llmFactory,
      planType: 'iterative',
    });
    
    // Run the orchestrator with iterative planning
    const resultIterative = await orchestratorIterative.complete([
      { role: 'user', content: task }
    ]);
    
    // End time measurement for iterative planning
    const endTimeIterative = Date.now();
    const executionTimeIterative = (endTimeIterative - startTimeIterative) / 1000; // Convert to seconds
    
    console.log(`\nIterative planning completed in ${executionTimeIterative.toFixed(2)} seconds`);
    console.log('Result excerpt:');
    console.log(resultIterative.choices[0].message.content.substring(0, 300) + '...');
    
    // Compare the approaches
    console.log('\n=== Comparing Planning Approaches ===');
    console.log(`Full Planning Time: ${executionTimeFull.toFixed(2)} seconds`);
    console.log(`Iterative Planning Time: ${executionTimeIterative.toFixed(2)} seconds`);
    console.log(`Time Difference: ${Math.abs(executionTimeFull - executionTimeIterative).toFixed(2)} seconds (${executionTimeFull > executionTimeIterative ? 'Iterative was faster' : 'Full was faster'})`);
    
    console.log('\n=== Analysis ===');
    console.log('For this grading task:');
    console.log('- Full planning works well because the steps are predictable (find story, analyze, write report)');
    console.log('- Iterative planning may be more adaptive if unexpected issues arise in the story');
    console.log('- The choice between approaches depends on the complexity and predictability of the grading task');
    
    // Shutdown all agents
    await Promise.all([
      finderAgent.shutdown(),
      writerAgent.shutdown(),
      proofreaderAgent.shutdown(),
      factCheckerAgent.shutdown(),
      styleEnforcerAgent.shutdown(),
    ]);
  });
}

// Run the example
main().catch(console.error);
