export function RulebookContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">The goal</h2>
        <p className="text-muted-foreground">
          Score more than your opponent before the 10-minute clock runs out. Every action ticks 10 seconds off.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">The pitch</h2>
        <p className="text-muted-foreground">
          22 columns by 11 rows. Home attacks right, away attacks left. Goals sit in column 1 (home) and column 22 (away),
          rows e through g.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Possession & action points</h2>
        <p className="text-muted-foreground">
          Every phase the team in possession gets <span className="font-bold text-foreground">3 action points</span>. Each
          move costs AP. When AP hits 0, possession flips and the other side gets 3 AP. You can also END TURN voluntarily.
        </p>
        <ul className="space-y-1 text-muted-foreground">
          <li>• Pass: <span className="font-bold text-foreground">1 AP</span></li>
          <li>• Off-ball run: <span className="font-bold text-foreground">1 AP</span></li>
          <li>• Dribble: <span className="font-bold text-foreground">2 AP</span></li>
          <li>• Shoot: <span className="font-bold text-foreground">2 AP</span></li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Move types</h2>
        <ul className="space-y-1 text-muted-foreground">
          <li>• <span className="font-bold text-foreground">Dribble</span> — ball carrier moves up to 2 cells. Forward or sideways only.</li>
          <li>• <span className="font-bold text-foreground">Pass</span> — ball carrier sends ball to a teammate up to 7 cells away.</li>
          <li>• <span className="font-bold text-foreground">Run</span> — off-ball player moves up to 3 cells.</li>
          <li>• <span className="font-bold text-foreground">Shoot</span> — must be within 3 cells of the opponent goal.</li>
          <li>• <span className="font-bold text-foreground">Tackle</span> — non-ball player steps onto the carrier within 2 cells.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Open receiver</h2>
        <p className="text-muted-foreground">
          A pass is blocked if <span className="font-bold text-foreground">2 or more defenders</span> sit within 1 cell of
          the target. One marker is fine — a swarm is not. Move teammates into space before passing into pressure.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Tackles & interceptions</h2>
        <p className="text-muted-foreground">
          Tackles swap positions: tackler takes the cell and the ball; the dispossessed player drops back to the tackler's
          old spot. A pass is intercepted if any defender sits within 1.2 cells of the pass line. Either event hands the
          opposition a fresh 3 AP.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Tips</h2>
        <ul className="space-y-1 text-muted-foreground">
          <li>• Spend AP like a budget. A 2-AP dribble plus a 1-AP pass ends the phase.</li>
          <li>• Stalled? END TURN is free — no clock cost — and beats wasting moves.</li>
          <li>• Stack two markers near the danger man. One isn't enough to stop the pass.</li>
          <li>• Shots near the goal-line with no defender within 2 cells go in.</li>
        </ul>
      </section>
    </div>
  );
}
