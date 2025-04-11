import { Network, DataSet, Node, Edge } from 'vis-network/standalone';
import { InseparableStatesOptimizer } from './InseparableStatesOptimizer';
import { DFAMainView } from "../views/DFAMainView";
import { DFAModel, State } from '../DFAModel';

export class InseparableStatesSimulator {
    protected mainView: DFAMainView | null = null;
    protected network: Network | null = null;
    protected model: DFAModel = new DFAModel();
    protected isOptimizing: boolean = false;
    protected currentStep: number = 0;
    protected optimizationSteps: Array<() => void> = [];

    constructor(protected automata: InseparableStatesOptimizer) {}

    getCurrentModel(): DFAModel {
        return this.model;
    }

    start(mainView: DFAMainView) {
        this.mainView = mainView;
        
        // Initialize with q0 if empty
        if (this.model.states.length === 0) {
            this.model.states.push({
                name: 'q0',
                initial: true,
                final: false
            });
        }

        const [nodes, edges] = [this.getNodes(), this.getEdges()];
        const options = { 
            physics: false, 
            edges: { font: { align: 'top' } },
            interaction: {
                selectable: true,
                multiselect: true,
            },
            manipulation: {
                enabled: true,
                addEdge: this.edgeAdded,
                addNode: this.nodeAdded,
            }
        };

        this.network = new Network(mainView.getNetworkContainer(), { nodes, edges }, options);
    }

    onOptimize = () => {
        if (this.isOptimizing) return;
        this.mainView?.clearLog();
        this.prepareOptimizationSteps();
        this.executeOptimization();
    };

    onStepByStepOptimize = () => {
        if (this.isOptimizing) return;
        this.mainView?.clearLog();
        this.prepareOptimizationSteps();
        this.executeNextStep();
    };

    onPauseSimulation = () => {
        this.isOptimizing = false;
    };

    protected prepareOptimizationSteps() {
        this.optimizationSteps = [];
        const inseparablePairs = this.findInseparableStates();
        
        if (inseparablePairs.length > 0) {
            this.optimizationSteps.push(() => {
                this.mainView?.logMessage(`Found inseparable pairs: ${inseparablePairs.map(p => p.join(' ↔ ')).join(', ')}`);
            });
            
            inseparablePairs.forEach(pair => {
                this.optimizationSteps.push(() => {
                    this.mergeStates(pair[0], pair[1]);
                    this.mainView?.logMessage(`Merged states: ${pair[0]} + ${pair[1]} → ${pair[0]}_${pair[1]}`);
                });
            });
        } else {
            this.optimizationSteps.push(() => {
                this.mainView?.logMessage('No inseparable states found');
            });
        }
    }

    protected executeOptimization() {
        this.isOptimizing = true;
        this.currentStep = 0;
        
        const executeNext = () => {
            if (this.currentStep < this.optimizationSteps.length && this.isOptimizing) {
                this.optimizationSteps[this.currentStep++]();
                setTimeout(executeNext, 1000);
            } else {
                this.isOptimizing = false;
            }
        };
        
        executeNext();
    }

    protected executeNextStep() {
        if (this.currentStep < this.optimizationSteps.length) {
            this.optimizationSteps[this.currentStep++]();
        } else {
            this.mainView?.logMessage('Optimization complete!');
        }
    }

    protected findInseparableStates(): Array<[string, string]> {
        const pairs: Array<[string, string]> = [];
        const states = this.model.states;
        const separable = new Map<string, boolean>();

        // Initial marking
        for (let i = 0; i < states.length; i++) {
            for (let j = i + 1; j < states.length; j++) {
                const key = `${states[i].name},${states[j].name}`;
                separable.set(key, states[i].final !== states[j].final);
            }
        }

        // Iterative refinement
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < states.length; i++) {
                for (let j = i + 1; j < states.length; j++) {
                    const key = `${states[i].name},${states[j].name}`;
                    if (!separable.get(key)) {
                        for (const symbol of this.model.symbols) {
                            const nextI = this.getNextState(states[i].name, symbol);
                            const nextJ = this.getNextState(states[j].name, symbol);
                            
                            if (nextI && nextJ && nextI !== nextJ) {
                                const nextKey = [nextI, nextJ].sort().join(',');
                                if (separable.get(nextKey)) {
                                    separable.set(key, true);
                                    changed = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Collect inseparable pairs
        for (const [key, isSeparable] of separable) {
            if (!isSeparable) {
                const [s1, s2] = key.split(',');
                pairs.push([s1, s2]);
            }
        }

        return pairs;
    }

    protected mergeStates(state1: string, state2: string) {
        const newStateName = `${state1}_${state2}`;
        const state1Obj = this.model.getStateByName(state1)!;
        const state2Obj = this.model.getStateByName(state2)!;
        
        const newState: State = {
            name: newStateName,
            initial: state1Obj.initial || state2Obj.initial,
            final: state1Obj.final || state2Obj.final
        };

        // Add new state
        this.model.states.push(newState);

        // Update transitions
        this.updateTransitions(state1, state2, newStateName);

        // Remove old states
        this.model.states = this.model.states.filter(s => s.name !== state1 && s.name !== state2);

        // Update network visualization
        this.updateNetwork();
    }

    protected updateTransitions(state1: string, state2: string, newState: string) {
       
        this.model.transitions = this.model.transitions.map(t => ({
            from: t.from === state1 || t.from === state2 ? newState : t.from,
            to: t.to === state1 || t.to === state2 ? newState : t.to,
            character: t.character
        }));

        // Remove duplicate transitions
        this.model.transitions = this.model.transitions.filter((t, index, self) =>
            index === self.findIndex(t2 => (
                t.from === t2.from && 
                t.to === t2.to && 
                t.character === t2.character
            ))
        );
    }

    protected getNextState(state: string, symbol: string): string | null {
        const transition = this.model.transitions.find(t => 
            t.from === state && t.character === symbol
        );
        return transition ? transition.to : null;
    }

    protected nodeAdded = (nodeData: Node, callback: (arg: Node) => void) => {
        const newNode = { 
            x: nodeData.x, 
            y: nodeData.y, 
            ...this.getNextStateData() 
        };
        callback(newNode);
    };

    protected edgeAdded = (edgeData: Edge, callback: (edge: Edge) => void) => {
        const character = prompt('Enter transition character:');
        if (!character) return;

        if (!this.model.symbols.includes(character)) {
            this.model.symbols.push(character);
        }

        this.model.transitions.push({
            from: edgeData.from as string,
            to: edgeData.to as string,
            character
        });

        edgeData.label = character;
        callback(edgeData);
    };

    protected getNextStateData(): Node {
        const nextState: State = { 
            name: `q${this.model.states.length}`,
            final: false,
            initial: false 
        };
        this.model.states.push(nextState);
        return { 
            id: nextState.name, 
            label: nextState.name, 
            shape: 'ellipse', 
            color: 'lightblue' 
        };
    }

    protected getNodes(): Node[] {
        return this.model.states.map(state => ({
            id: state.name,
            label: state.name + (state.initial ? ' (Start)' : state.final ? ' (Final)' : ''),
            shape: 'ellipse',
            color: state.initial ? '#90EE90' : state.final ? '#FFA07A' : '#ADD8E6',
            borderWidth: 2
        }));
    }

    protected getEdges(): Edge[] {
        return this.model.transitions.map(transition => ({
            from: transition.from,
            to: transition.to,
            label: transition.character,
            arrows: 'to',
            smooth: {
                enabled: true,
                type: 'curvedCW',
                roundness: 0.2
            },
            font: {
                align: 'middle'
            }
        }) as Edge);
    }

    protected updateNetwork() {
        if (!this.network) return;
    
        const nodes = new DataSet(this.getNodes());
        const edges = new DataSet(this.getEdges());
        
        // Get positions with proper type handling
        const positions = this.network.getPositions(nodes.getIds() as string[]);
        
        // Corrected iteration with proper type handling
        nodes.forEach((node: Node) => {
            const nodeId = node.id?.toString(); // Handle possible undefined
            if (nodeId && positions[nodeId]) {
                node.x = positions[nodeId].x;
                node.y = positions[nodeId].y;
            }
        });
    
        this.network.setData({ nodes, edges });
        this.network.redraw();
    }
}