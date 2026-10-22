import type { ConfiguredMaterialsState } from './configured-materials';

interface DesignerPalette {
  readonly id: string; readonly name: string; readonly materials: ConfiguredMaterialsState;
  readonly kitchen?: Partial<ConfiguredMaterialsState>;
}
const palette = (id: string, name: string, carcassDecorId: string, frontDecorId: string,
  extra: Partial<ConfiguredMaterialsState> = {}, kitchen?: Partial<ConfiguredMaterialsState>): DesignerPalette => ({
  id, name, materials: { carcassDecorId, frontDecorId, handleFinish: 'matte_black',
    internalAccessoryFinish: 'matte_black', linkedDecors: false, frontProfile: 'slab', integratedLed: false, ...extra },
  ...(kitchen ? { kitchen } : {}),
});
export const designerPalettes: readonly DesignerPalette[] = [
  palette('warm-japandi', 'Warm Japandi', 'egger-f416-st10', 'egger-h3157-st12',
    { drawerDecorId: 'egger-f416-st10', backingDecorId: 'egger-f416-st10-backing-6' }),
  palette('cashmere-wild-oak', 'Cashmere & Wild Oak', 'egger-h1318-st10', 'egger-u702-pm',
    { handleFinish: 'anodized_champagne', internalAccessoryFinish: 'anodized_champagne' }),
  palette('boutique-walk-in', 'Boutique Walk-In', 'egger-h3734-st9', 'agc-glass-planibel-grey-float',
    { drawerDecorId: 'egger-f433-st10', backingDecorId: 'egger-f433-st10-backing-6', integratedLed: true }),
  palette('nordic-sage-ash', 'Nordic Sage & Ash', 'egger-h1250-st36', 'fenix-0750-ntm'),
  palette('architectural-monochrome', 'Architectural Monochrome', 'egger-u961-pm', 'egger-f206-st9',
    { integratedLed: true, handleFinish: 'handleless_tip_on' },
    { frontDecorId: 'egger-u961-pm', worktopDecorId: 'egger-f206-st9-worktop-38', backsplashDecorId: 'egger-f206-st9-backsplash-12' }),
  palette('classic-parisian', 'Classic Parisian', 'egger-h3309-st28', 'egger-w1000-st9',
    { frontProfile: 'micro_shaker', handleFinish: 'brushed_brass' }),
];
