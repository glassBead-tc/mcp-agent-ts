/**
 * Orchestrator Iterative Planning Example
 * 
 * This example demonstrates how to use the iterative planning mode in the Orchestrator workflow
 * for tasks that require adaptation based on previous results.
 */
import { 
  MCPApp, 
  Agent, 
  OpenAIAugmentedLLM,
  Orchestrator
} from '../src';

/**
 * Example function to search for information
 */
async function searchInformation(query: string): Promise<string> {
  // Simulate different search results based on the query
  if (query.includes('renewable energy')) {
    return `
      Search results for "${query}":
      
      1. Solar Energy: Solar power is one of the most mature renewable energy technologies.
         - Photovoltaic (PV) systems convert sunlight directly into electricity
         - Solar thermal systems use sunlight to heat water or air
         - Concentrated solar power (CSP) systems use mirrors to concentrate sunlight
      
      2. Wind Energy: Wind power is one of the fastest-growing renewable energy sources.
         - Onshore wind farms are built on land
         - Offshore wind farms are built in bodies of water
         - Small wind turbines can be used for residential or commercial applications
      
      3. Hydroelectric Power: Hydropower is the largest renewable energy source for electricity generation.
         - Conventional hydroelectric uses dams to store water
         - Run-of-river hydroelectricity uses the natural flow of water
         - Pumped storage hydroelectricity stores energy by pumping water uphill
      
      4. Geothermal Energy: Geothermal energy harnesses heat from the Earth's core.
         - Geothermal power plants generate electricity
         - Geothermal heat pumps use the Earth's constant temperature for heating and cooling
      
      5. Biomass Energy: Biomass is organic material from plants and animals.
         - Direct combustion of biomass for heat and electricity
         - Conversion to biofuels like ethanol and biodiesel
         - Anaerobic digestion to produce biogas
    `;
  } else if (query.includes('solar energy')) {
    return `
      Search results for "${query}":
      
      Recent advancements in solar energy technology:
      
      1. Perovskite Solar Cells: These cells have shown rapid efficiency improvements, reaching over 25% in lab settings.
         - Cheaper to manufacture than traditional silicon cells
         - Can be printed on flexible substrates
         - Potential for transparent solar windows
      
      2. Bifacial Solar Panels: These panels capture sunlight from both sides.
         - Can increase energy production by 10-30%
         - Work well in snowy environments where light reflects from the ground
         - Becoming more cost-effective as manufacturing scales up
      
      3. Solar Tracking Systems: Advanced tracking systems follow the sun's movement.
         - Single-axis tracking can increase output by 25-35%
         - Dual-axis tracking can increase output by 35-45%
         - Smart tracking algorithms optimize for weather conditions
      
      4. Integrated Solar Roofing: Solar cells built directly into roofing materials.
         - Tesla Solar Roof and similar products
         - Aesthetically pleasing alternative to traditional panels
         - Becoming more affordable as technology matures
      
      5. Floating Solar Farms: Solar panels installed on bodies of water.
         - Reduces land use
         - Water cooling effect increases efficiency
         - Can reduce water evaporation from reservoirs
    `;
  } else if (query.includes('wind energy')) {
    return `
      Search results for "${query}":
      
      Recent advancements in wind energy technology:
      
      1. Larger Turbines: The trend toward larger turbines continues.
         - GE's Haliade-X: 14 MW capacity, 220-meter rotor diameter
         - Vestas V236-15.0: 15 MW capacity, 236-meter rotor diameter
         - Larger turbines capture more energy with fewer installations
      
      2. Floating Offshore Wind: Turbines that can be installed in deeper waters.
         - Opens up new areas for wind development
         - Hywind Scotland: World's first floating wind farm
         - Reduces visual impact by being further from shore
      
      3. Airborne Wind Energy: Kite-like systems that harness wind at higher altitudes.
         - Access to stronger, more consistent winds
         - Requires less material than conventional turbines
         - Companies like Makani (Google) and Kitepower leading development
      
      4. Smart Wind Farms: AI and IoT integration for optimized performance.
         - Predictive maintenance reduces downtime
         - Wake steering increases overall farm output
         - Machine learning optimizes blade pitch and yaw
      
      5. Bladeless Wind Turbines: Oscillating structures that generate electricity without blades.
         - Reduced wildlife impact
         - Lower maintenance costs
         - Less noise pollution
    `;
  } else if (query.includes('hydroelectric')) {
    return `
      Search results for "${query}":
      
      Recent advancements in hydroelectric power:
      
      1. Small-scale Hydropower: Smaller installations with less environmental impact.
         - Run-of-river systems that don't require large dams
         - Modular designs that can be scaled as needed
         - Suitable for remote communities and microgrids
      
      2. Fish-friendly Turbines: Designs that reduce harm to aquatic life.
         - Alden turbine with slower rotation and fewer blades
         - Archimedes screw turbines allow fish passage
         - Advanced screening systems to prevent fish entrainment
      
      3. Variable Speed Turbines: Adaptable to changing water flow conditions.
         - Increased efficiency across different flow rates
         - Better grid stability and frequency regulation
         - Reduced mechanical stress during operation
      
      4. Pumped Storage Innovations: Advanced energy storage using water.
         - Closed-loop systems with reduced environmental impact
         - Underground pumped storage using abandoned mines
         - Integration with other renewable sources for grid balancing
      
      5. Hydrokinetic Turbines: Harness energy from rivers and tides without dams.
         - In-stream turbines for rivers and canals
         - Tidal turbines for predictable ocean energy
         - Oscillating hydrofoils that mimic fish movement
    `;
  } else {
    return `Search results for "${query}": No specific information found. Please refine your search.`;
  }
}

/**
 * Example function to analyze data
 */
async function analyzeData(data: string): Promise<string> {
  // Simulate data analysis
  return `Analysis complete. The data contains information about various renewable energy technologies and their advancements.`;
}

/**
 * Main function
 */
async function main() {
  // Create app
  const app = new MCPApp({
    name: 'orchestrator-iterative-planning',
  });
  
  // Run the app
  await app.run(async (app) => {
    console.log('Creating agents...');
    
    // Create specialized agents
    const researchAgent = new Agent({
      name: 'researcher',
      instruction: 'You are a research agent that finds information about renewable energy technologies. You should search for specific technologies based on the task and previous findings.',
      functions: [searchInformation],
      context: app.context,
    });
    
    const analysisAgent = new Agent({
      name: 'analyst',
      instruction: 'You are an analysis agent that evaluates renewable energy technologies based on their efficiency, cost, scalability, and environmental impact.',
      functions: [analyzeData],
      context: app.context,
    });
    
    const writerAgent = new Agent({
      name: 'writer',
      instruction: 'You are a writer agent that creates reports and summaries based on research and analysis.',
      context: app.context,
    });
    
    const recommendationAgent = new Agent({
      name: 'recommender',
      instruction: 'You are a recommendation agent that provides actionable recommendations based on analysis and research.',
      context: app.context,
    });
    
    // Initialize all agents
    await Promise.all([
      researchAgent.initialize(),
      analysisAgent.initialize(),
      writerAgent.initialize(),
      recommendationAgent.initialize(),
    ]);
    
    // Create LLM factory function
    const llmFactory = async (agent: Agent) => {
      return new OpenAIAugmentedLLM({
        agent,
        model: 'gpt-4o',
      });
    };
    
    console.log('\n=== Running Orchestrator with Iterative Planning ===');
    console.log('Task: Research renewable energy technologies and recommend the most promising ones for immediate implementation');
    
    // Create orchestrator with iterative planning
    const orchestrator = new Orchestrator({
      availableAgents: [researchAgent, analysisAgent, writerAgent, recommendationAgent],
      llmFactory,
      planType: 'iterative', // Use iterative planning mode
    });
    
    // Start time measurement
    const startTime = Date.now();
    
    // Run the orchestrator
    const result = await orchestrator.complete([
      { 
        role: 'user', 
        content: 'Research the latest advancements in renewable energy technologies and create a report recommending which ones are most promising for immediate implementation. Focus on technologies that are cost-effective and scalable.' 
      }
    ]);
    
    // End time measurement
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000; // Convert to seconds
    
    console.log(`\nExecution completed in ${executionTime.toFixed(2)} seconds`);
    console.log('\n=== Final Report ===');
    console.log(result.choices[0].message.content);
    
    console.log('\n=== Benefits of Iterative Planning in This Example ===');
    console.log('1. Adaptive Research: The research agent could focus on specific technologies based on initial findings');
    console.log('2. Progressive Refinement: Each step built upon the results of previous steps');
    console.log('3. Efficient Resource Use: Only the necessary agents were involved at each step');
    console.log('4. Dynamic Decision Making: The plan adapted as new information was discovered');
    
    // Shutdown all agents
    await Promise.all([
      researchAgent.shutdown(),
      analysisAgent.shutdown(),
      writerAgent.shutdown(),
      recommendationAgent.shutdown(),
    ]);
  });
}

// Run the example
main().catch(console.error);
