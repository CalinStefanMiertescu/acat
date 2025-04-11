import { Network, DataSet, Node, Edge } from 'vis-network/standalone';
import { InaccessibleStatesOptimizer } from './InaccessibleStatesOptimizer.ts';
import { DFAMainView } from '../views/DFAMainView.ts';
import { DFAModel, State } from '../DFAModel.ts';

/**
 * Does the actual simulation of the Inaccessible States Optimizer
 */
export class InaccessibleStatesSimulator {
    // the simulator view
    protected mainView: DFAMainView | null = null;

    // references the network of states
    protected network: Network | null = null;

    // references the DFAModel
    protected model: DFAModel = new DFAModel();

    // timeout reference for simulation delays
    protected currentTimeout: number | null = null;

    // variables for step-by-step module
    protected stepByStepInput: string = '';
    protected currentIndex: number = 0;
    protected stepByStepActive: boolean = false;

    protected removalStepIndex: number = 0;
    protected inaccessibleStates: State[] = [];
    protected inaccessibleRemovalDone: boolean = false;



    /**
     * The constructor receives the Automata instance
     */
    constructor(protected automata: InaccessibleStatesOptimizer) {}

    /**
     * Returns access to the DFA Model
     */
    getCurrentModel(): DFAModel {
        return this.model;
    }

    /**
     * Entry point for starting the simulation
     */
    start(mainView: DFAMainView) {
        // initializing the DFA model
        this.model.states.push({ name: 'q0', initial: true, final: false });

        // keeping track of the container
        this.mainView = mainView;
        // creating the network of states
        const nodes = new DataSet(this.getNodes());
        const edges = new DataSet(this.getEdges());
        // setting up display options for how to render the network
        const options = { 
            physics: true, 
            edges: { font: { align: 'top' } },
            interaction: {
                selectable: true,
                multiselect: true
            },
            manipulation: {
                enabled: true,
                addEdge: this.edgeAdded,
                addNode: this.nodeAdded
            }
        };
        // instantiating the network of states
        this.network = new Network(mainView.getNetworkContainer(), { nodes, edges }, options);

        /**
         * Subscribing to select node event
         */
        this.network.on('selectNode', (params: any) => {
            console.log('Node selected:', params.nodes[0]);
        });
    }

    /**
     * Updates the network visualization after state changes
     */
    protected updateNetwork() {
        if (!this.network) return;
        
        const nodes = new DataSet(this.getNodes());
        const edges = new DataSet(this.getEdges());
        
        // Get current positions to maintain layout
        const positions = this.network.getPositions();
        nodes.forEach((node: Node) => {
            const nodeId = node.id as string;
            if (positions[nodeId]) {
                nodes.update({
                    id: nodeId,
                    x: positions[nodeId].x,
                    y: positions[nodeId].y
                });
            }
        });

        this.network.setData({ nodes, edges });
    }

    /**
     * Invoked when the user clicks the play button for the simulation
     */
    onPlaySimulation = () => {
        const input = this.mainView!.getTestInput();
        if (!input) {
            alert('Please enter input for simulation');
            return;
        }

        // clearing the output console
        this.mainView?.clearLog();

        // letting the UI know that we started the simulation
        this.mainView?.logMessage(`Starting simulation for: ${input}`, 'success');

        // begin the state removal process
        this.removeInaccessibleStatesWithVisualization(input);
    };

    /**
     * Removes inaccessible states with visual feedback
     */
    protected async removeInaccessibleStatesWithVisualization(input: string) {
        try {
            // Step 1: Show initial state
            await this.highlightState(this.model.getInitialState(), 'orange', 1000);
            this.mainView?.logMessage('Searching for inaccessible states...');
            await this.delay(800);
    
            // Step 2: Find accessible states
            this.mainView?.logMessage('Analyzing state reachability...');
            await this.delay(600);
            const accessibleStates = this.getAccessibleStates();
            
            // Step 3: Identify and process inaccessible states
            const removedStates = this.model.states.filter(s => !accessibleStates.includes(s.name));
            
            if (removedStates.length > 0) {
                if(removedStates.length == 1){
                this.mainView?.logMessage(`Found ${removedStates.length} inaccessible state:`, 'error');
                } else {        
                    this.mainView?.logMessage(`Found ${removedStates.length} inaccessible states:`, 'error');
                }
                await this.delay(800);
                
                // Step 4: Process each inaccessible state individually
                for (const state of removedStates) {
                    this.mainView?.logMessage(`Removing inaccessible state: ${state.name}`, 'error');
                    await this.highlightState(state, 'red', 800);
                    await this.delay(500);
                }
                
                // Step 5: Remove them from model
                this.mainView?.logMessage('Updating automaton...');
                await this.delay(600);
                this.model.states = this.model.states.filter(s => accessibleStates.includes(s.name));
                this.model.transitions = this.model.transitions.filter(t =>
                    accessibleStates.includes(t.from) && accessibleStates.includes(t.to)
                );
                
                this.updateNetwork();
                await this.delay(800);
                this.mainView?.logMessage('Automaton optimized successfully!', 'success');
                await this.delay(600);
            } else {
                this.mainView?.logMessage('No inaccessible states found - automaton is already optimal', 'success');
                await this.delay(800);
            }
    
            // Step 6: Run normal simulation
            this.mainView?.logMessage('Starting input simulation...');
            await this.delay(1000);
            this.runNormalSimulation(input);
        } catch (error) {
            console.error('Optimization error:', error);
            this.mainView?.logMessage('Error during optimization process', 'error');
        }
    }

    /**
     * Finds all accessible states from the initial state
     */
    protected getAccessibleStates(): string[] {
        const accessible = new Set<string>([this.model.getInitialState().name]);
        const queue: string[] = [this.model.getInitialState().name];
    
        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const t of this.model.transitions.filter(tr => tr.from === current)) {
                if (!accessible.has(t.to)) {
                    accessible.add(t.to);
                    queue.push(t.to);
                }
            }
        }
        
        return Array.from(accessible);
    }

    /**
     * Runs the normal simulation after removing inaccessible states
     */
    protected async runNormalSimulation(input: string) {
        // reset to initial state
        this.model.currentState = this.model.states.indexOf(this.model.getInitialState());
        this.highlightStateAndEdge(this.model.getInitialState());

        this.currentTimeout = window.setTimeout(async () => {
            // process each character in the input
            for (let i = 0; i < input.length; i++) {
                const char = input[i];
                this.mainView?.logMessage(`Processing: ${char}`);
                
                // get next state based on current character
                const nextState = await this.transitionFunction(char);
                if (nextState === -1) {
                    this.network?.updateClusteredNode(this.model.states[this.model.currentState].name, { color: 'palevioletred' });
                    break;
                }
                this.model.currentState = nextState;
            }

            // check if we reached a final state
            const finalState = this.model.states[this.model.currentState];
            if (finalState.final) {
                this.mainView?.logMessage(`Input accepted: ${input}`, 'success');
            } else {
                this.mainView?.logMessage(`Input rejected: ${input}`, 'error');
            }

            // reset after delay
            this.currentTimeout = window.setTimeout(() => this.onPauseSimulation(), 1000);
        }, 1000);
    }

    /**
     * Invoked when the user pauses the simulation
     */
    onPauseSimulation = () => {
        // stopping the current timeout if exists
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }
        // resetting to initial state
        this.model.currentState = this.model.states.indexOf(this.model.getInitialState());
        // resetting node colors
        this.resetNodesColors();
    };

    /**
     * Executes the simulation in a step-by-step manner
     */
   

    onPlayStepByStepOptimization = async () => {
        // Initial setup
        if (!this.stepByStepActive) {
            this.stepByStepActive = true;
            this.mainView?.clearLog();
            this.mainView?.logMessage('Step-by-step: Removing inaccessible states...', 'success');

            // Step 0: Highlight initial state
            await this.highlightState(this.model.getInitialState(), 'orange');
            this.mainView?.logMessage('Searching for inaccessible states...');
            this.removalStepIndex = 0;

            // Step 1: Calculate inaccessible states
            const accessible = this.getAccessibleStates();
            this.inaccessibleStates = this.model.states.filter(s => !accessible.includes(s.name));

            if (this.inaccessibleStates.length === 0) {
                this.mainView?.logMessage('No inaccessible states found - automaton is already optimal.', 'success');
                this.inaccessibleRemovalDone = true;
                return;
            }

            if (this.inaccessibleStates.length === 1) {
                this.mainView?.logMessage('Found 1 inaccessible state:', 'error');
            } else {
                this.mainView?.logMessage(`Found ${this.inaccessibleStates.length} inaccessible states:`, 'error');
            }
        }

        // If finished
        if (this.inaccessibleRemovalDone) {
            this.mainView?.logMessage('All inaccessible states removed. Ready for simulation.', 'success');
            this.stepByStepActive = false;
            return;
        }

        // Step-by-step removal
        if (this.removalStepIndex < this.inaccessibleStates.length) {
            const stateToRemove = this.inaccessibleStates[this.removalStepIndex];
            this.mainView?.logMessage(`Removing: ${stateToRemove.name}`, 'error');
            await this.highlightState(stateToRemove, 'red');
            this.removalStepIndex++;
        } else {
            // All inaccessible states have been processed
            this.model.states = this.model.states.filter(s => !this.inaccessibleStates.includes(s));
            this.model.transitions = this.model.transitions.filter(t =>
                !this.inaccessibleStates.some(s => s.name === t.from || s.name === t.to)
            );

            const initialState = this.model.states.find(s => s.initial);
            if (!initialState) {
                this.mainView?.logMessage('No initial state found after optimization', 'error');
                return;
            }
            this.model.currentState = this.model.states.indexOf(initialState);

            this.updateNetwork();
            this.inaccessibleRemovalDone = true;
            this.mainView?.logMessage('Automaton optimized successfully!', 'success');
        }

    };


    onPlayStepByStepSimulation = async () => {
        // First: handle step-by-step removal of inaccessible states
        if (!this.inaccessibleRemovalDone) {
            // Initialize step-by-step removal
            if (!this.stepByStepActive) {
                this.stepByStepActive = true;
                this.mainView?.clearLog();
                this.mainView?.logMessage('Step-by-step: Removing inaccessible states...', 'success');

                // Highlight initial state
                await this.highlightState(this.model.getInitialState(), 'orange');
                this.mainView?.logMessage('Searching for inaccessible states...');
                this.removalStepIndex = 0;

                // Calculate inaccessible states
                const accessible = this.getAccessibleStates();
                this.inaccessibleStates = this.model.states.filter(s => !accessible.includes(s.name));

                if (this.inaccessibleStates.length === 0) {
                    this.mainView?.logMessage('No inaccessible states found - automaton is already optimal.', 'success');
                    this.inaccessibleRemovalDone = true;
                    this.stepByStepActive = false;
                    return;
                }

                this.mainView?.logMessage(
                    `Found ${this.inaccessibleStates.length} inaccessible state(s): ${this.inaccessibleStates.map(s => s.name).join(', ')}`,
                    'error'
                );
                return;
            }

            // Remove each inaccessible state one at a time
            if (this.removalStepIndex < this.inaccessibleStates.length) {
                const stateToRemove = this.inaccessibleStates[this.removalStepIndex];
                this.mainView?.logMessage(`Removing: ${stateToRemove.name}`, 'error');
                await this.highlightState(stateToRemove, 'red');
                this.removalStepIndex++;
                return;
            }

            // Finalize removal
            this.model.states = this.model.states.filter(s => !this.inaccessibleStates.includes(s));
            this.model.transitions = this.model.transitions.filter(t =>
                !this.inaccessibleStates.some(s => s.name === t.from || s.name === t.to)
            );

            // Reset currentState if initial state was shifted in index
            const initialStateName = this.model.getInitialState().name;
            const updatedInitialState = this.model.states.find(s => s.name === initialStateName);
            if (updatedInitialState) {
                this.model.currentState = this.model.states.indexOf(updatedInitialState);
            }

            this.updateNetwork();
            this.inaccessibleRemovalDone = true;
            this.stepByStepActive = false;
            this.mainView?.logMessage('Automaton optimized successfully!', 'success');
            return;
        }

        // --- DFA input simulation ---
        if (!this.stepByStepActive) {
            this.stepByStepActive = true;
            this.stepByStepInput = this.mainView!.getTestInput();
            if (!this.stepByStepInput) {
                alert('Please enter input for simulation');
                this.stepByStepActive = false;
                return;
            }

            // Reset simulation state
            this.mainView?.clearLog();
            this.mainView?.logMessage(`Step-by-step for: ${this.stepByStepInput}`, 'success');
            const initialState = this.model.getInitialState();
            this.model.currentState = this.model.states.indexOf(initialState);
            this.highlightStateAndEdge(initialState);
            this.currentIndex = 0;
            return;
        }

        // Log the states and transitions for debugging
        console.log('States:', this.model.states.map(s => `${s.name} (final: ${s.final})`));
        console.log('Transitions:', this.model.transitions);

        // Check if all input is processed
        if (this.currentIndex >= this.stepByStepInput.length) {
            this.mainView?.logMessage('Simulation complete');
            this.stepByStepActive = false;
            return;
        }

        // Process current character
        const char = this.stepByStepInput[this.currentIndex];
        const currentState = this.model.states[this.model.currentState];
        this.mainView?.logMessage(`Current state: ${currentState.name}`);
        this.mainView?.logMessage(`Processing: ${char}`);

        // Log the available transitions from the current state
        const availableTransitions = this.model.transitions.filter(t => t.from === currentState.name);
        console.log(`Available transitions from ${currentState.name}:`, availableTransitions);

        // Get the next state for the current character
        const nextStateIndex = await this.transitionFunction(char);

        // Check if the nextStateIndex is valid
        if (nextStateIndex === -1) {
            this.network?.updateClusteredNode(currentState.name, { color: 'palevioletred' });
            this.mainView?.logMessage('Input rejected', 'error');
            this.stepByStepActive = false;
            return;
        }

        // Update the current state and index
        this.model.currentState = nextStateIndex;
        this.currentIndex++;

        // Final state check
        if (this.currentIndex === this.stepByStepInput.length) {
            const finalState = this.model.states[this.model.currentState];
            this.mainView?.logMessage(`Final state: ${finalState.name}`);
            if (finalState.final) {
                this.mainView?.logMessage('Input accepted', 'success');
            } else {
                this.mainView?.logMessage('Input rejected', 'error');
            }
            this.resetNodesColors();
            this.stepByStepActive = false;
        }
    };


    /**
     * Handler that will be invoked when a new node will be added
     */
    protected nodeAdded = (nodeData: Node, callback: (arg: Node) => void) => {
        const newNode = { x: nodeData.x, y: nodeData.y, ...this.getNextStateData() };
        callback(newNode);

        // update previous node if we have more than two nodes
        if (this.model.states.length > 2) {
            const previous = this.model.states[this.model.states.length - 2];
            const previousNode: Node = { 
                id: previous.name, 
                label: previous.name, 
                color: 'lightblue' 
            };
            this.network?.updateClusteredNode(previousNode.id!, { 
                label: previousNode.label, 
                color: previousNode.color 
            });
        }
    };

    /**
     * Invoked when a new edge has been added
     */
    protected edgeAdded = (edgeData: Edge, callback: (edge: Edge) => void) => {
        // requesting the character that will validate next state
        const character = prompt('Enter transition character:');
        if (!character) {
            alert('Transition character required');
            return;
        }

        // add the new transition to the model
        this.model.transitions.push({ 
            from: edgeData.from as string, 
            to: edgeData.to as string, 
            character 
        });

        edgeData.label = character;
        callback(edgeData);
    };

    /**
     * Returns a new node definition
     */
    protected getNextStateData(): Node {
        const nextState: State = { 
            name: 'q' + this.model.states.length, 
            final: true, 
            initial: false 
        };
        this.model.states.push(nextState);
        return { 
            id: nextState.name, 
            label: nextState.name + ' (Final)', 
            shape: 'ellipse', 
            color: 'lightgreen' 
        };
    }


    /**
     * The transition function that handles moving to the next state
     */
    protected transitionFunction = async (char: string): Promise<number> => {
        return new Promise(resolve => {
            let nextState = -1;
            const currentState = this.model.getCurrentState();

            // search for a valid transition
            for (const transition of this.model.transitions) {
                if (currentState.name === transition.from && transition.character === char) {
                    const next = this.model.getStateByName(transition.to);
                    nextState = next ? this.model.states.indexOf(next) : -1;
                    this.highlightStateAndEdge(this.model.states[this.model.currentState]);
                    break;
                }
            }

            // delay for visualization
            this.currentTimeout = window.setTimeout(() => resolve(nextState), 1000);
        });
    };

    /**
     * Highlights the current state and edge
     */
    protected highlightStateAndEdge(state: State) {
        this.resetNodesColors();
        this.network?.updateClusteredNode(state.name, { color: 'yellow' });
    }

    /**
     * Resets all nodes to their default colors
     */
    protected resetNodesColors() {
        this.model.states.forEach(state => {
            const color = state.initial || state.final ? 'lightgreen' : 'lightblue';
            this.network?.updateClusteredNode(state.name, { color });
        });
    }

    /**
     * Returns the list of nodes created based on the model's states
     */
    protected getNodes(): Node[] {
        return this.model.states.map(state => ({
            id: state.name,
            label: state.name + (state.initial ? ' (Start)' : state.final ? ' (Final)' : ''),
            shape: 'ellipse',
            color: state.initial || state.final ? 'lightgreen' : 'lightblue'
        }));
    }

    /**
     * Returns the list of edges created based on the model's transition table
     */
    protected getEdges(): Edge[] {
        return this.model.transitions.map(transition => ({
            label: transition.character,
            from: transition.from,
            to: transition.to
        }));
    }

    /**
     * Returns the main view
     */
    getMainView(): DFAMainView {
        return this.mainView || new DFAMainView();
    }

/**
 * Highlights a state with the specified color and duration
 * @param state The state to highlight
 * @param color The highlight color
 * @param duration The duration of the highlight in milliseconds
 */
protected async highlightState(state: State, color: string, duration: number = 500): Promise<void> {
    return new Promise(resolve => {
        this.network?.updateClusteredNode(state.name, { color });
        setTimeout(resolve, duration);
    });
}

    /**
     * Highlights multiple states with the specified color
     */
    protected async highlightStates(states: State[], color: string): Promise<void> {
        for (const state of states) {
            await this.highlightState(state, color);
        }
    }

    /**
     * Highlights a transition with the specified color
     */
    protected async highlightTransition(transition: {from: string, to: string}, color: string): Promise<void> {
        return new Promise(resolve => {
            if (!this.network) {
                resolve();
                return;
            }
            
            // find and update the edge color
            const edges = this.getEdges();
            const edgeIndex = edges.findIndex(e => 
                e.from === transition.from && e.to === transition.to
            );
            
            if (edgeIndex !== -1) {
                const edge = edges[edgeIndex];
                this.network?.updateEdge(edge.id || edgeIndex, { 
                    color: { color, highlight: color } 
                });
            }
            setTimeout(resolve, 500);
        });
    }

    /**
     * Simple delay function for animations
     */
    protected delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}