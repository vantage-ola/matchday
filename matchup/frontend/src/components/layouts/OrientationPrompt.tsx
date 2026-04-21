export function OrientationPrompt() {
  return (
    <div className="flex md:hidden fixed inset-0 z-[100] bg-primary-container flex-col items-center justify-center p-8 text-center text-on-primary">
      <span className="material-symbols-outlined text-5xl mb-4">screen_rotation</span>
      <h2 className="text-2xl font-bold tracking-tight mb-2">ROTATE DEVICE</h2>
      <p className="text-sm opacity-80 max-w-xs">
        This tactical interface requires landscape orientation.
      </p>
    </div>
  );
}
