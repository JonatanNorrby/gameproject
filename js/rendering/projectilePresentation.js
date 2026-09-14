const TAU = Math.PI * 2;

function drawFriendlyProjectile(ctx, projectile) {
  ctx.strokeStyle = projectile.type === 'laser' ? '#ff5967' : '#fff0a0';
  ctx.lineWidth = projectile.type === 'laser' ? 4 : 1.6;
  ctx.beginPath();
  ctx.moveTo(
    projectile.x - (Number(projectile.vx) || 0) * .016,
    projectile.y - (Number(projectile.vy) || 0) * .016,
  );
  ctx.lineTo(projectile.x, projectile.y);
  ctx.stroke();
}

function drawHostileProjectile(ctx, projectile) {
  ctx.fillStyle = '#9cff55';
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 4, 0, TAU);
  ctx.fill();
}

function drawMine(ctx, mine) {
  ctx.fillStyle = '#2d3339';
  ctx.beginPath();
  ctx.arc(mine.x, mine.y, 8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#d7a8ef';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawEffect(ctx, effect, now) {
  const expires = Number(effect.expires);
  const duration = Number(effect.durationMs) || 1;
  const alpha = Number.isFinite(expires) ? Math.max(0, Math.min(1, (expires - now) / duration)) : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(.12, alpha);
  if (effect.kind === 'tesla' && effect.points?.length) {
    ctx.strokeStyle = '#b881ff'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(effect.points[0].x, effect.points[0].y);
    for (const point of effect.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  } else if (Number.isFinite(effect.x1) && Number.isFinite(effect.x2)) {
    ctx.strokeStyle = effect.kind === 'rail' ? '#79e9ff' : effect.kind === 'prism' ? '#ff6f78' : effect.kind?.includes('flame') ? '#ff8b32' : '#ffd36b';
    ctx.lineWidth = effect.kind === 'rail' ? 5 : effect.kind === 'prism' ? 3 : 2.5;
    ctx.beginPath(); ctx.moveTo(effect.x1, effect.y1); ctx.lineTo(effect.x2, effect.y2); ctx.stroke();
  } else if (Number.isFinite(effect.x) && Number.isFinite(effect.y)) {
    ctx.strokeStyle = effect.kind === 'cryo' ? '#8eeaff' : '#ffd36b';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, Math.max(8, Number(effect.r) || 18), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

export function drawProductionProjectiles(game, ctx) {
  for (const projectile of game?.state?.entities?.projectiles || []) {
    if (projectile?.team === 'enemy') drawHostileProjectile(ctx, projectile);
    else drawFriendlyProjectile(ctx, projectile);
  }
  // Kept only as a compatibility read for tests/tools that still construct the
  // pre-Step-8 secondary array. Production enemy AI uses the unified collection.
  for (const projectile of game?.state?.entities?.enemyProjectiles || []) drawHostileProjectile(ctx, projectile);
  for (const mine of game?.state?.entities?.playerMines || []) drawMine(ctx, mine);
  const nowSource = game?.services?.now;
  const now = typeof nowSource === 'function' ? Number(nowSource()) || 0 : 0;
  for (const effect of game?.state?.entities?.effects || []) drawEffect(ctx, effect, now);
  return true;
}
