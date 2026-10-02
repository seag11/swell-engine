# swell-engine

Surf conditions triangulated from public NOAA buoy and tide data. A TypeScript
API and React client, with the wave model as a separate Python program behind a
JSON contract — see `swellkit/AGENTS.md` for the model itself.

## Conventions

Keep other tools and products out of the source. Looking at how they handle
something is useful; writing their names into comments isn't. Point at the
underlying standard, paper or agency instead, or just state the convention:

> Face height is the convention surf forecasters use.

Data sources are different — NOAA, NDBC and CO-OPS get named because the code
calls them.

Comments are for the why. A hidden constraint, a subtle invariant, something
that would surprise a reader. If nobody would miss it, leave it out.

And if a decision is still open, don't settle it in a comment. Someone will read
it as the answer.
