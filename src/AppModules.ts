import { AppMenu } from './modules/menu/app-menu/AppMenu.ts';
import { ContextMenu } from './modules/menu/context-menu/ContextMenu.ts';
import { HamburgerMenu } from './modules/menu/hamburger-menu/HamburgerMenu.ts';
import { AppLogo } from './modules/menu/app-logo/AppLogo.ts';
import { DFASimulation } from './modules/automata/finite-automata/DFASimulation.ts';
import { Theme } from './modules/theme/theme.ts';
import { OptimizingInaccessibleStatesSimulation } from './modules/automata/finite-automata/dfa/InaccessibleStates/OptimizingInaccessibleStatesSimulation.ts'; // Importăm noua simulare
import { OptimizingInseparableStatesSimulation } from './modules/automata/finite-automata/dfa/InseparableStates/OptimizingInseparableStatesSimulation.ts';
import { SystemInteraction } from './modules/system-interaction/SystemInteraction.ts';
import { Localization } from './modules/localization/views/Localization.ts';

/**
 * Constant that hold the names of the modules
 */
export const ModuleNames = {
    AppMenu: 'app-menu',
    HamburgerMenu: 'hamburger-menu',
    AppLogo: 'app-logo',
    ContextMenu: 'context-menu',
    DeterministicFiniteAutomata: 'automata-dfa',
    Theme: 'theme-button',
    OptimizingInaccessibleStatesSimulation: 'optimized-inaccessible-dfa',
    OptimizingInseparableStatesSimulation: 'optimizing-inseparable-states',
    SystemInteraction: 'system-interaction',
    Localization: 'localization',
} as const;

/**
 * Holds the list of all the modules this application loads
 */
export const AppModules = {
    [ModuleNames.Localization]: Localization,
    [ModuleNames.HamburgerMenu]: HamburgerMenu,
    [ModuleNames.AppLogo]: AppLogo,
    [ModuleNames.AppMenu]: AppMenu,
    [ModuleNames.ContextMenu]: ContextMenu,
    [ModuleNames.DeterministicFiniteAutomata]: DFASimulation,
    [ModuleNames.Theme]: Theme,
    [ModuleNames.OptimizingInaccessibleStatesSimulation]: OptimizingInaccessibleStatesSimulation, // Adăugăm noua simulare
    [ModuleNames.OptimizingInseparableStatesSimulation]: OptimizingInseparableStatesSimulation,
    [ModuleNames.SystemInteraction]: SystemInteraction,

} as const;

/**
 * Returns the type that defines the all valid names for a module
 */
export type ModuleName = (typeof ModuleNames)[keyof typeof ModuleNames];

/**
 * Returns the type that defines all the module instances the application uses
 */
export type AppModule = InstanceType<(typeof AppModules)[keyof typeof AppModules]>;
