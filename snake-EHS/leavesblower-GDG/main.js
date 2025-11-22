class BlowpipeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BlowpipeScene' });
    // Collections and gameplay state
    this.leaves = [];
    this.leafCount = 0;
    this.blower = null;
    this.cursors = null;
    this.blowKey = null;

    // Floor / grass layout
    this.floorBounds = null; // { left, right, top, bottom }

    // Blower + wind state
    this.blowerSpeed = 260;
    this.blowerPower = 0; // 0..1, how strong the blower is right now
    this.blowerOn = false;
    this.residualWindTimer = 0; // seconds of residual wind after turning off
    this.maxResidualWindTime = 2; // seconds
    // Air is always emitted from the physical nozzle on the left side of the blower sprite.
    this.blowDirection = new Phaser.Math.Vector2(-1, 0);

    // Timer & win/lose state
    this.totalTime = 0; // seconds, derived from number of leaves
    this.remainingTime = 0; // seconds
    this.timerText = null;
    this.gameEnded = false;
    this.gameWon = false;
    this.endMessageText = null;
    this.restartButton = null;

    // Clean-floor tracking
    this.isFloorClean = false;
    this._lastReportedCleanState = null;

    // UI
    this.powerBarGraphics = null;
    this.powerBarLabel = null;
  }

  preload() {
    this.load.image('block', 'assets/images/block.png');
    this.load.image('tree', 'assets/images/tree.png');
    this.load.image('leaf', 'assets/images/leaf.png'); // Use PNG!
    this.load.image('blower', 'assets/images/blower.png');
  }

  create() {
    const { width: canvasWidth, height: canvasHeight } = this.scale;

    // Grass background to fill the area outside the floor.
    this.cameras.main.setBackgroundColor('#3b7a2a');

    // === 1. Floor configuration: 80% of canvas, centered, 8x8 blocks ===
    const floorWidth = canvasWidth * 0.8;
    const floorHeight = canvasHeight * 0.8;

    const cols = 8;
    const rows = 8;

    // Each block's displayed size in pixels so that 8x8 blocks exactly fill 80% of width/height.
    const blockDisplayWidth = floorWidth / cols;
    const blockDisplayHeight = floorHeight / rows;

    // Get the original source size from the texture to compute scale.
    const blockSource = this.textures.get('block').getSourceImage();
    const blockSrcWidth = blockSource.width;
    const blockSrcHeight = blockSource.height;

    // Scale factors to map source sprite to the display cell.
    const blockScaleX = blockDisplayWidth / blockSrcWidth;
    const blockScaleY = blockDisplayHeight / blockSrcHeight;

    // Top-left block center so that the full 8x8 matrix is centered on the canvas.
    const floorStartX = (canvasWidth - floorWidth) / 2 + blockDisplayWidth / 2;
    const floorStartY = (canvasHeight - floorHeight) / 2 + blockDisplayHeight / 2;

    // Floor bounds rectangle (used for detecting grass vs floor and clamping the blower).
    const floorLeft = floorStartX - blockDisplayWidth / 2;
    const floorTop = floorStartY - blockDisplayHeight / 2;
    const floorRight = floorLeft + floorWidth;
    const floorBottom = floorTop + floorHeight;

    this.floorBounds = { left: floorLeft, right: floorRight, top: floorTop, bottom: floorBottom };
    this.blockDisplayWidth = blockDisplayWidth;
    this.blockDisplayHeight = blockDisplayHeight;

    // === 2. Draw the 8x8 floor matrix of blocks ===
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.add
          .image(
            floorStartX + col * blockDisplayWidth,
            floorStartY + row * blockDisplayHeight,
            'block'
          )
          .setScale(blockScaleX, blockScaleY);
      }
    }

    // === 3. Leaves cluster in the middle region of the floor ===
    // Each leaf should be 1/4th the width and height of a floor block (4 times smaller than a block).
    const leafSource = this.textures.get('leaf').getSourceImage();
    const leafSrcWidth = leafSource.width;
    const leafSrcHeight = leafSource.height;

    const leafDisplayWidth = blockDisplayWidth / 2;
    const leafDisplayHeight = blockDisplayHeight / 2;

    const leafScaleX = leafDisplayWidth / leafSrcWidth;
    const leafScaleY = leafDisplayHeight / leafSrcHeight;

    this.leaves = [];

    // Define a central region over the floor for the leaf pile (roughly middle third).
    const pileWidth = floorWidth / 3;
    const pileHeight = floorHeight / 3;
    const pileCenterX = canvasWidth / 2;
    const pileCenterY = canvasHeight / 2;

    const leavesCount = 60; // Dense cluster of leaves
    this.leafCount = leavesCount;

    for (let i = 0; i < leavesCount; i++) {
      // Random base position inside the pile rectangle.
      const baseX = Phaser.Math.Between(
        Math.floor(pileCenterX - pileWidth / 2),
        Math.floor(pileCenterX + pileWidth / 2)
      );
      const baseY = Phaser.Math.Between(
        Math.floor(pileCenterY - pileHeight / 2),
        Math.floor(pileCenterY + pileHeight / 2)
      );

      // Small jitter so they don't look aligned.
      const jitterX = Phaser.Math.Between(-blockDisplayWidth / 10, blockDisplayWidth / 10);
      const jitterY = Phaser.Math.Between(-blockDisplayHeight / 10, blockDisplayHeight / 10);

      const leaf = this.physics.add
        .image(baseX + jitterX, baseY + jitterY, 'leaf')
        .setScale(leafScaleX, leafScaleY);

      leaf.setCollideWorldBounds(true);
      leaf.body.setAllowGravity(false);
      // We control leaf speed manually; no extra physics drag.
      leaf.setDamping(false);
      leaf.setDrag(0, 0);

      this.leaves.push(leaf);
    }

    // === 4. Timer configuration based on leaf count ===
    // Simple rule: each leaf grants 1 second of time.
    const baseTimePerLeaf = 1.0;
    this.totalTime = this.leafCount * baseTimePerLeaf;
    this.remainingTime = this.totalTime;

    // === 5. Blower player-controlled object ===
    // Start it slightly above the bottom-center of the floor.
    const blowerX = (this.floorBounds.left + this.floorBounds.right) / 2;
    const blowerY = this.floorBounds.bottom - this.blockDisplayHeight * 1.5;

    // Scale blower so it feels comparable to floor tiles and not gigantic.
    const blowerSource = this.textures.get('blower').getSourceImage();
    const blowerSrcWidth = blowerSource.width;
    const blowerSrcHeight = blowerSource.height;
    const desiredBlowerWidth = blockDisplayWidth * 1.2;
    const desiredBlowerHeight = blockDisplayHeight * 0.8;
    const blowerScale = Math.min(
      desiredBlowerWidth / blowerSrcWidth,
      desiredBlowerHeight / blowerSrcHeight
    );

    this.blower = this.physics.add.image(blowerX, blowerY, 'blower').setScale(blowerScale);
    this.blower.setCollideWorldBounds(true);
    this.blower.body.setAllowGravity(false);
    this.blower.setImmovable(false);

    // === 6. Input setup ===
    this.cursors = this.input.keyboard.createCursorKeys();
    this.blowKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);

    // === 7. UI: Power bar + clean state text ===
    this.powerBarGraphics = this.add.graphics();
    this.powerBarGraphics.setScrollFactor(0);

    this.powerBarLabel = this.add
      .text(canvasWidth - 170, 4, 'Power', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffffff'
      })
      .setScrollFactor(0);

    this.cleanText = this.add
      .text(12, 10, 'Floor: dirty', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff'
      })
      .setScrollFactor(0);

    // Timer UI (top‑center)
    this.timerText = this.add
      .text(canvasWidth / 2, 10, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff'
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.updateTimerText();
  }

  update(time, delta) {
    const dt = delta / 1000;

    if (!this.gameEnded) {
      this.handleBlowerMovement(dt);
      this.handleBlowing(dt);
      this.updateLeaves(dt);
      this.updateFloorCleanState();
      this.updateTimer(dt);
    }
    this.drawPowerBar();
  }

  handleBlowerMovement(dt) {
    if (this.gameEnded) return;
    if (!this.blower || !this.cursors) return;

    const speed = this.blowerSpeed;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown) {
      vx = -speed;
    } else if (this.cursors.right.isDown) {
      vx = speed;
    }

    if (this.cursors.up.isDown) {
      vy = -speed;
    } else if (this.cursors.down.isDown) {
      vy = speed;
    }

    this.blower.body.setVelocity(vx, vy);

    // Clamp blower to floor area (with small margin so it doesn't overlap blocks visually).
    const marginX = this.blockDisplayWidth * 0.3;
    const marginY = this.blockDisplayHeight * 0.3;

    this.blower.x = Phaser.Math.Clamp(
      this.blower.x,
      this.floorBounds.left + marginX,
      this.floorBounds.right - marginX
    );
    this.blower.y = Phaser.Math.Clamp(
      this.blower.y,
      this.floorBounds.top + marginY,
      this.floorBounds.bottom - marginY
    );
  }

  getNozzleWorldPosition() {
    if (!this.blower) {
      return { x: 0, y: 0 };
    }

    const w = this.blower.displayWidth;
    // Physical nozzle is on the left-center of the blower sprite.
    return {
      x: this.blower.x - w * 0.45,
      y: this.blower.y
    };
  }

  handleBlowing(dt) {
    if (this.gameEnded) return;
    if (!this.blowKey) return;

    const isPressed = this.blowKey.isDown;
    const powerRampTime = 1.0; // seconds to reach full power

    if (isPressed) {
      this.blowerOn = true;
      this.blowerPower = Phaser.Math.Clamp(this.blowerPower + dt / powerRampTime, 0, 1);
      this.residualWindTimer = this.maxResidualWindTime; // refresh residual while blowing
    } else {
      // Turn off almost immediately when key is released.
      this.blowerOn = false;
      this.blowerPower = 0;
    }
  }

  updateLeaves(dt) {
    if (this.gameEnded) return;
    if (!this.leaves || this.leaves.length === 0) return;

    const baseSpeed = 220; // target speed when fully pushed by the blower
    const range = this.blockDisplayWidth * 4; // how far the wind reaches
    const halfWidth = this.blockDisplayHeight * 1.2; // cone/strip thickness

    const nozzle = this.getNozzleWorldPosition();
    const dir = this.blowDirection.clone().normalize();

    if (this.blowerOn && this.blowerPower > 0) {
      // While the blower is on, every leaf's speed is a monotonic *decreasing*
      // function of its distance to the nozzle:
      //  - closest to the nozzle => highest speed
      //  - farther away => smoothly slower
      //  - at the end of the wind range => minimum (but non‑zero) speed
      //  - once outside the wind range => speed becomes 0
      //
      // We enforce this by *overwriting* each leaf's velocity every frame
      // based purely on its distance, so past motion cannot break monotonicity.
      const minSpeedFactor = 0.3; // 30% of baseSpeed at the end of the range

      this.leaves.forEach(leaf => {
        if (!leaf.body) return;

        // First, check if the leaf is geometrically inside the wind "strip".
        if (!this.isLeafWithinWindZone(leaf, nozzle, dir, range, halfWidth)) {
          // Outside the wind range: it should not keep moving due to the blower.
          leaf.body.setVelocity(0, 0);
          return;
        }

        // Transform to nozzle‑relative coordinates.
        const relX = leaf.x - nozzle.x;
        const relY = leaf.y - nozzle.y;

        // Use Euclidean distance from the nozzle so that the speed is
        // a smooth scalar function of the true distance.
        const radialDist = Math.sqrt(relX * relX + relY * relY);
        if (radialDist <= 0 || radialDist > range) {
          leaf.body.setVelocity(0, 0);
          return;
        }

        // Normalized distance in [0, 1], 0 = at nozzle, 1 = at end of range.
        const normalized = Phaser.Math.Clamp(radialDist / range, 0, 1);

        // Monotonic decreasing distance factor:
        //  - at 0: factor = 1.0  (max speed)
        //  - at 1: factor = minSpeedFactor (min but non‑zero speed)
        const strengthFalloff = 1 - normalized; // 1 -> 0 as distance grows
        const distanceFactor = minSpeedFactor + (1 - minSpeedFactor) * strengthFalloff;

        // Target speed based solely on distance and blower power.
        const targetSpeed = baseSpeed * this.blowerPower * distanceFactor;

        leaf.body.velocity.x = dir.x * targetSpeed;
        leaf.body.velocity.y = dir.y * targetSpeed;
      });
    } else {
      // Residual wind phase: keep leaves moving but smoothly slow them down over 2 seconds.
      if (this.residualWindTimer > 0) {
        this.residualWindTimer = Math.max(0, this.residualWindTimer - dt);

        // Factor shrinks linearly from 1 -> 0 over residual time.
        const factor = this.residualWindTimer / this.maxResidualWindTime;

        this.leaves.forEach(leaf => {
          if (!leaf.body) return;
          const v = leaf.body.velocity;
          v.x *= factor;
          v.y *= factor;
        });
      }
    }

    // If residual wind is gone, stop all leaves completely.
    if (!this.blowerOn && this.residualWindTimer <= 0) {
      this.leaves.forEach(leaf => {
        if (!leaf.body) return;
        leaf.body.setVelocity(0, 0);
      });
    }
  }

  isLeafWithinWindZone(leaf, nozzle, dir, range, halfWidth) {
    // Transform leaf position relative to nozzle.
    const relX = leaf.x - nozzle.x;
    const relY = leaf.y - nozzle.y;

    // Project onto wind direction to get "forward" distance.
    const forward = relX * dir.x + relY * dir.y;
    if (forward < 0 || forward > range) return false;

    // Sideways distance from wind axis.
    // Sideways vector is perpendicular to dir.
    const sideX = -dir.y;
    const sideY = dir.x;
    const sideways = Math.abs(relX * sideX + relY * sideY);
    return sideways <= halfWidth;
  }

  updateFloorCleanState() {
    if (this.gameEnded) return;
    if (!this.floorBounds) return;

    const { left, right, top, bottom } = this.floorBounds;

    // A leaf is "on the floor" if it lies within these bounds.
    let anyLeafOnFloor = false;
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i];
      if (!leaf.active) continue;

      const x = leaf.x;
      const y = leaf.y;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        anyLeafOnFloor = true;
        break;
      }
    }

    this.isFloorClean = !anyLeafOnFloor;

    // Simple UI + console exposure of the clean-floor state.
    if (this.cleanText) {
      this.cleanText.setText(this.isFloorClean ? 'Floor: clean' : 'Floor: dirty');
    }

    if (this._lastReportedCleanState !== this.isFloorClean) {
      this._lastReportedCleanState = this.isFloorClean;
      console.log('Floor clean state:', this.isFloorClean ? 'CLEAN' : 'DIRTY');
    }
  }

  updateTimer(dt) {
    // If the floor becomes clean before time runs out, the player wins.
    if (this.isFloorClean && !this.gameEnded) {
      this.handleWin();
      return;
    }

    if (this.remainingTime <= 0 || this.gameEnded) {
      return;
    }

    this.remainingTime = Math.max(0, this.remainingTime - dt);
    this.updateTimerText();

    // Time has run out and floor is still dirty: game over (failure).
    if (this.remainingTime === 0 && !this.isFloorClean && !this.gameEnded) {
      this.handleLose();
    }
  }

  updateTimerText() {
    if (!this.timerText) return;
    const totalSeconds = Math.ceil(this.remainingTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = seconds.toString().padStart(2, '0');
    this.timerText.setText(`Time: ${minutes}:${paddedSeconds}`);
  }

  handleWin() {
    this.gameEnded = true;
    this.gameWon = true;
    this.stopAllMotion();
    this.showEndMessage(true);
  }

  handleLose() {
    this.gameEnded = true;
    this.gameWon = false;
    this.stopAllMotion();
    this.showEndMessage(false);
    this.showRestartButton();
  }

  stopAllMotion() {
    // Stop blower and leaves movement.
    if (this.blower && this.blower.body) {
      this.blower.body.setVelocity(0, 0);
    }
    if (this.leaves) {
      this.leaves.forEach(leaf => {
        if (!leaf.body) return;
        leaf.body.setVelocity(0, 0);
      });
    }
    this.residualWindTimer = 0;
    this.blowerPower = 0;
  }

  showEndMessage(isWin) {
    const { width: canvasWidth, height: canvasHeight } = this.scale;
    const message = isWin
      ? '¡Victoria! Has limpiado todas las hojas a tiempo.'
      : 'Tiempo agotado. No pudiste limpiar todas las hojas.';

    if (this.endMessageText) {
      this.endMessageText.setText(message);
    } else {
      this.endMessageText = this.add
        .text(canvasWidth / 2, canvasHeight / 2 - 40, message, {
          fontFamily: 'Arial',
          fontSize: '24px',
          color: '#ffffff',
          backgroundColor: '#00000080',
          align: 'center',
          wordWrap: { width: canvasWidth * 0.7 }
        })
        .setOrigin(0.5);
    }
  }

  showRestartButton() {
    const { width: canvasWidth, height: canvasHeight } = this.scale;

    if (this.restartButton) {
      this.restartButton.setVisible(true);
      this.restartButton.removeAllListeners();
    }

    this.restartButton = this.add
      .text(canvasWidth / 2, canvasHeight / 2 + 20, 'Reiniciar juego', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#1976d280',
        padding: { left: 12, right: 12, top: 6, bottom: 6 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.restartButton.on('pointerup', () => {
      this.scene.restart();
    });
  }

  drawPowerBar() {
    if (!this.powerBarGraphics) return;

    const canvasWidth = this.scale.width;
    const barWidth = 150;
    const barHeight = 14;
    const xRight = canvasWidth - 10;
    const yTop = 20;

    this.powerBarGraphics.clear();

    // Background
    this.powerBarGraphics.fillStyle(0x000000, 0.5);
    this.powerBarGraphics.fillRect(xRight - barWidth, yTop, barWidth, barHeight);

    // Foreground based on blowerPower (0..1)
    const power = Phaser.Math.Clamp(this.blowerPower, 0, 1);
    const fillColor = 0xffd54f; // amber-like
    this.powerBarGraphics.fillStyle(fillColor, 1);
    this.powerBarGraphics.fillRect(
      xRight - barWidth,
      yTop,
      barWidth * power,
      barHeight
    );
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  // Grass-colored background. The floor only covers 80% of the canvas so the rest looks like grass.
  backgroundColor: '#3b7a2a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }
    }
  },
  scene: BlowpipeScene
};

const game = new Phaser.Game(config);

console.info('Phaser version', Phaser.VERSION, 'initialized successfully.');
