import { AbstractFiniteSimulation } from '../../AbstractFiniteSimulation.ts';
import { Application } from '../../../../../types/Application.ts';
import { ModuleNames } from '../../../../../AppModules.ts';
import { DrawerItem } from '../../../../menu/hamburger-menu/views/DrawerItem.ts';
import { InseparableStatesOptimizer } from './InseparableStatesOptimizer.ts';

export class OptimizingInseparableStatesSimulation extends AbstractFiniteSimulation {
    initialize(app: Application) {
        super.initialize(app);

        const category = app.getModule(ModuleNames.HamburgerMenu)?.getCategory(AbstractFiniteSimulation.menuId);
        if (category === null) return;

        category?.addItem(new DrawerItem({ 
            displayName: 'Optimizing Inseparable States', 
            onclick: () => this.simulate() 
        }));
    }

    simulate(): void {
        this.app?.getModule(ModuleNames.HamburgerMenu)?.onToggleMenu();
        this.app?.simulateAutomata(new InseparableStatesOptimizer());
    }
}
