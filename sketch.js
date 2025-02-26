// Global variables
let stars = [];
let player;
let enemies = [];
let bullets = [];
let explosions = [];
let gameOver = false;
let score = 0;
let wave = 0;
let enemyDirection = 1;
let enemySpeed = 2;
let mothership = null;
let mothershipInterval = 15000; // Spawn every 15 seconds
let lastMothershipTime = 0;
let aiPowerups = [];
let powerupTypes = [
  {name: 'GPT', color: '#10a37f', symbol: '⚡'}, // Green for speed
  {name: 'DALL-E', color: '#FF69B4', symbol: '✧'}, // Pink for spread
  {name: 'Claude', color: '#7B68EE', symbol: '★'} // Purple for power
];
let playerPowerup = null;
let powerupDuration = 5000;
let powerupTimer = 0;
let particles = [];

// Add to global variables
const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

let leaderboardUI;
let isSubmittingScore = false;

// Setup function to initialize the game
function setup() {
  createCanvas(800, 600);
  // Initialize leaderboardUI
  leaderboardUI = document.getElementById('leaderboardUI');
  
  // Create stars for the background
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      speed: random(0.5, 2)
    });
  }
  player = new Player();
  spawnEnemies(5, 3);
}

// Draw function to handle game rendering and logic
function draw() {
  background(0);
  // Draw and move stars
  for (let star of stars) {
    fill(255);
    noStroke();
    ellipse(star.x, star.y, star.size);
    star.y += star.speed;
    if (star.y > height) {
      star.y = 0;
    }
  }

  if (gameOver) {
    showLeaderboard();
    noLoop(); // Stop the game loop
  } else {
    // Game in progress
    player.draw();
    player.move();

    // Handle bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].draw();
      bullets[i].move();
      if (bullets[i].y < 0 || bullets[i].y > height) {
        bullets.splice(i, 1);
      }
    }

    // Coordinate enemy movement
    if (enemies.length > 0) {
      let leftmost = Math.min(...enemies.map(e => e.x));
      let rightmost = Math.max(...enemies.map(e => e.x));
      if (leftmost < enemies[0].width / 2 || rightmost > width - enemies[0].width / 2) {
        enemyDirection *= -1;
        for (let enemy of enemies) {
          enemy.y += 10;
        }
      }
    }

    // Draw and update enemies
    for (let enemy of enemies) {
      enemy.draw();
      enemy.move();
      enemy.shoot();
    }

    // Handle explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].draw();
      if (explosions[i].isDone()) {
        explosions.splice(i, 1);
      }
    }

    // Handle mothership spawning and movement
    if (!mothership && millis() - lastMothershipTime > mothershipInterval) {
      mothership = new Mothership();
      lastMothershipTime = millis();
    }
    
    if (mothership) {
      mothership.draw();
      if (mothership.move()) {
        mothership = null;
      }
    }

    // Handle AI powerups
    if (random() < 0.001) { // 0.1% chance each frame
      aiPowerups.push(new AIPowerup());
    }

    for (let i = aiPowerups.length - 1; i >= 0; i--) {
      aiPowerups[i].draw();
      if (aiPowerups[i].move()) {
        aiPowerups.splice(i, 1);
      }
    }

    checkCollisions();

    // Spawn new wave if all enemies are cleared
    if (enemies.length === 0) {
      wave++;
      spawnEnemies(5, 3 + wave);
    }

    // Check if enemies reach the player
    for (let enemy of enemies) {
      if (enemy.y + enemy.height >= player.y) {
        gameOver = true;
      }
    }

    // Display UI
    fill(255);
    textSize(20);
    textAlign(LEFT);
    text("Score: " + score, 10, 30);
    text("Lives: ", 10, 60);
    
    // Draw heart symbols for lives
    for (let i = 0; i < player.lives; i++) {
      text("❤️", 70 + (i * 25), 60);
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].draw();
      if (particles[i].isDead()) {
        particles.splice(i, 1);
      }
    }
  }
}

// Handle key presses
function keyPressed() {
  if (key === ' ') {
    player.shoot();
  } else if (key === 'r' && gameOver) {
    restartGame();
  }
}

// Restart the game
function restartGame() {
  player = new Player();
  enemies = [];
  bullets = [];
  explosions = [];
  score = 0;
  gameOver = false;
  wave = 0;
  spawnEnemies(5, 3);
  mothership = null;
  lastMothershipTime = 0;
  aiPowerups = [];
  player.powerup = null;
  leaderboardUI.style.display = 'none';
  loop(); // Restart the game loop
}

// Spawn enemies in a grid
function spawnEnemies(cols, rows) {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let type = floor(random(3));
      enemies.push(new Enemy(100 + i * 60, 100 + j * 40, type));
    }
  }
}

// Check for collisions
function checkCollisions() {
  // Add powerup collision detection
  for (let i = aiPowerups.length - 1; i >= 0; i--) {
    if (
      aiPowerups[i].x > player.x - player.width/2 &&
      aiPowerups[i].x < player.x + player.width/2 &&
      aiPowerups[i].y > player.y - player.height &&
      aiPowerups[i].y < player.y
    ) {
      player.applyPowerup(aiPowerups[i].type);
      aiPowerups.splice(i, 1);
      score += 25;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].isPlayerBullet) {
      // Check mothership collision
      if (mothership) {
        if (
          bullets[i].x > mothership.x - mothership.width/2 &&
          bullets[i].x < mothership.x + mothership.width/2 &&
          bullets[i].y > mothership.y - mothership.height/2 &&
          bullets[i].y < mothership.y + mothership.height/2
        ) {
          // Store mothership position before nullifying it
          const motherX = mothership.x;
          const motherY = mothership.y;
          
          // Add score and create first explosion
          score += mothership.points;
          explosions.push(new Explosion(motherX, motherY));
          
          // Remove bullet and mothership
          bullets.splice(i, 1);
          mothership = null;
          
          // Create additional explosions using stored positions
          for (let j = 0; j < 5; j++) {
            explosions.push(new Explosion(
              motherX + random(-30, 30),
              motherY + random(-15, 15)
            ));
          }
          continue;
        }
      }
      
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (
          bullets[i].x > enemies[j].x - enemies[j].width / 2 &&
          bullets[i].x < enemies[j].x + enemies[j].width / 2 &&
          bullets[i].y > enemies[j].y &&
          bullets[i].y < enemies[j].y + enemies[j].height
        ) {
          explosions.push(new Explosion(enemies[j].x, enemies[j].y));
          score += 10 * (enemies[j].type + 1);
          enemies.splice(j, 1);
          bullets.splice(i, 1);
          break;
        }
      }
    } else {
      if (
        !player.invulnerable &&
        bullets[i].x > player.x - player.width / 2 &&
        bullets[i].x < player.x + player.width / 2 &&
        bullets[i].y > player.y - player.height &&
        bullets[i].y < player.y
      ) {
        player.hit();
        bullets.splice(i, 1);
        if (player.lives <= 0) {
          gameOver = true;
        }
      }
    }
  }
}

// Player class
class Player {
  constructor() {
    this.x = width / 2;
    this.y = height - 20;
    this.width = 50;
    this.height = 10;
    this.speed = 5;
    this.lives = 3;
    this.lastShotTime = 0;
    this.shotCooldown = 500; // milliseconds
    this.invulnerable = false;
    this.powerup = null;
    this.powerupEndTime = 0;
  }

  hit() {
    this.lives--;
    // Add visual feedback when player is hit
    explosions.push(new Explosion(this.x, this.y));
    // Make player briefly invulnerable
    this.invulnerable = true;
    setTimeout(() => {
      this.invulnerable = false;
    }, 1500); // 1.5 seconds of invulnerability
  }

  draw() {
    if (!this.invulnerable || frameCount % 10 < 5) {
      push();
      // Thruster particles
      if (random() < 0.5) {
        particles.push(new Particle(
          this.x + random(-10, 10),
          this.y,
          color(255, 150, 0),
          1.5
        ));
      }
      
      // Shield effect when powered up
      if (this.powerup) {
        let shieldColor;
        switch(this.powerup) {
          case 'GPT': shieldColor = color('#10a37f80'); break;
          case 'DALL-E': shieldColor = color('#FF69B480'); break;
          case 'Claude': shieldColor = color('#7B68EE80'); break;
        }
        noFill();
        stroke(shieldColor);
        strokeWeight(2);
        arc(this.x, this.y - this.height/2, this.width * 1.5, 50, PI, TWO_PI);
      }

      // Enhanced ship design
      // Thruster glow
      noStroke();
      fill(255, 150, 0, 100);
      ellipse(this.x, this.y, 20, 5);
      
      // Main ship body
      stroke(0, 150, 255);
      strokeWeight(2);
      fill(0, 0, 200);
      beginShape();
      vertex(this.x - this.width/2, this.y);
      vertex(this.x - this.width/4, this.y - this.height);
      vertex(this.x + this.width/4, this.y - this.height);
      vertex(this.x + this.width/2, this.y);
      endShape(CLOSE);
      
      // Cockpit
      fill(200, 230, 255);
      noStroke();
      ellipse(this.x, this.y - this.height/2, 15, 10);
      
      pop();
    }
  }

  move() {
    if (keyIsDown(LEFT_ARROW) && this.x > this.width / 2) {
      this.x -= this.speed;
    }
    if (keyIsDown(RIGHT_ARROW) && this.x < width - this.width / 2) {
      this.x += this.speed;
    }
  }

  shoot() {
    if (millis() - this.lastShotTime > this.shotCooldown) {
      if (this.powerup === 'DALL-E') {
        // Triple spread shot
        bullets.push(new Bullet(this.x, this.y - this.height, -2, -10, true));
        bullets.push(new Bullet(this.x, this.y - this.height, 0, -10, true));
        bullets.push(new Bullet(this.x, this.y - this.height, 2, -10, true));
      } else {
        bullets.push(new Bullet(this.x, this.y - this.height, 0, -10, true));
      }
      this.lastShotTime = millis();
    }

    // Check if powerup has expired
    if (this.powerup && millis() > this.powerupEndTime) {
      this.powerup = null;
      this.shotCooldown = 500;
      this.speed = 5;
    }
  }

  applyPowerup(type) {
    this.powerup = type;
    this.powerupEndTime = millis() + powerupDuration;
    
    switch(type) {
      case 'GPT':
        this.shotCooldown = 100; // Faster shooting
        break;
      case 'DALL-E':
        // Spread shot
        break;
      case 'Claude':
        this.speed = 8; // Faster movement
        break;
    }
  }
}

// Enemy class
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = 20;
    this.height = 15;
    this.lastShotTime = 0;
    this.shotInterval = 2000;
    this.glowPhase = random(TWO_PI);
    this.baseColor = color(
      type === 0 ? '#FF4444' :
      type === 1 ? '#44FF44' :
      '#4444FF'
    );
  }

  draw() {
    push();
    // Glow effect
    let glowIntensity = (sin(frameCount * 0.05 + this.glowPhase) + 1) * 0.5;
    let c = color(this.baseColor);
    c.setAlpha(100 * glowIntensity);
    
    noStroke();
    fill(c);
    ellipse(this.x, this.y, this.width * 1.5, this.height * 1.5);
    
    // Main body
    fill(this.baseColor);
    if (this.type === 0) {
      // Diamond shape
      beginShape();
      vertex(this.x, this.y - this.height/2);
      vertex(this.x + this.width/2, this.y);
      vertex(this.x, this.y + this.height/2);
      vertex(this.x - this.width/2, this.y);
      endShape(CLOSE);
    } else if (this.type === 1) {
      // Hexagon shape
      beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = i * TWO_PI / 6;
        vertex(
          this.x + cos(angle) * this.width/2,
          this.y + sin(angle) * this.height/2
        );
      }
      endShape(CLOSE);
    } else {
      // Energy orb
      fill(this.baseColor);
      ellipse(this.x, this.y, this.width, this.height);
      fill(255, 255, 255, 150);
      ellipse(this.x - 2, this.y - 2, this.width/3, this.height/3);
    }
    pop();
  }

  move() {
    this.x += enemySpeed * enemyDirection;
  }

  shoot() {
    if (millis() - this.lastShotTime > this.shotInterval) {
      bullets.push(new Bullet(this.x, this.y + this.height, 0, 10, false));
      this.lastShotTime = millis();
    }
  }
}

// Bullet class
class Bullet {
  constructor(x, y, vx, vy, isPlayerBullet) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = 5;
    this.height = 5;
    this.isPlayerBullet = isPlayerBullet;
  }

  draw() {
    push();
    // Glowing effect
    let bulletColor = this.isPlayerBullet ? 
      color(100, 150, 255) : 
      color(255, 100, 100);
    
    noStroke();
    // Outer glow
    fill(bulletColor.levels[0], bulletColor.levels[1], bulletColor.levels[2], 100);
    ellipse(this.x, this.y, this.width * 2);
    
    // Inner bullet
    fill(bulletColor);
    ellipse(this.x, this.y, this.width);
    
    // Trail effect
    if (random() < 0.5) {
      particles.push(new Particle(
        this.x,
        this.y + (this.isPlayerBullet ? 5 : -5),
        bulletColor,
        this.isPlayerBullet ? 1 : -1
      ));
    }
    pop();
  }

  move() {
    this.x += this.vx;
    this.y += this.vy;
  }
}

// Explosion class
class Explosion {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.maxRadius = 20;
    this.alpha = 255;
  }

  draw() {
    noFill();
    stroke(255, this.alpha);
    ellipse(this.x, this.y, this.radius * 2);
    this.radius += 1;
    this.alpha -= 15;
  }

  isDone() {
    return this.alpha <= 0;
  }
}

// Mothership class
class Mothership {
  constructor() {
    this.width = 80;
    this.height = 30;
    this.speed = 3;
    this.points = 100;
    // Start outside the screen on a random side
    this.direction = random() < 0.5 ? 1 : -1;
    this.x = this.direction === 1 ? -this.width : width + this.width;
    this.y = 50;
  }

  draw() {
    // Main body
    fill(255, 0, 255);
    ellipse(this.x, this.y, this.width, this.height);
    // Dome
    fill(200, 0, 200);
    arc(this.x, this.y - 5, this.width * 0.6, this.height, PI, TWO_PI);
    // Lights
    fill(255, 255, 0);
    for (let i = -2; i <= 2; i++) {
      circle(this.x + (i * 15), this.y + 5, 5);
    }
  }

  move() {
    this.x += this.speed * this.direction;
    return this.x < -this.width || this.x > width + this.width;
  }
}

// Add new AIpowerup class
class AIPowerup {
  constructor() {
    this.type = random(powerupTypes);
    this.width = 30;
    this.height = 30;
    this.x = random(this.width, width - this.width);
    this.y = -this.height;
    this.speed = 2;
    this.powerupInfo = random(powerupTypes);
    this.rotation = 0;
  }

  draw() {
    push();
    translate(this.x, this.y);
    this.rotation += 0.05;
    rotate(this.rotation);
    
    // Glow effect
    let glowSize = 40 + sin(frameCount * 0.1) * 5;
    noStroke();
    fill(color(this.powerupInfo.color + '40'));
    ellipse(0, 0, glowSize, glowSize);
    
    // Power-up symbol
    textAlign(CENTER, CENTER);
    textSize(24);
    fill(this.powerupInfo.color);
    text(this.powerupInfo.symbol, 0, 0);
    pop();

    // Trailing particles
    if (random() < 0.3) {
      particles.push(new Particle(
        this.x + random(-5, 5),
        this.y + random(-5, 5),
        color(this.powerupInfo.color),
        1
      ));
    }
  }

  move() {
    this.y += this.speed;
    return this.y > height;
  }
}

// Add new Particle class
class Particle {
  constructor(x, y, color, speed) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.alpha = 255;
    this.size = random(2, 5);
    this.speed = speed;
  }

  draw() {
    noStroke();
    let c = color(this.color);
    c.setAlpha(this.alpha);
    fill(c);
    ellipse(this.x, this.y, this.size);
    this.alpha -= 5;
    this.y += this.speed;
    this.size *= 0.95;
  }

  isDead() {
    return this.alpha <= 0 || this.size < 0.5;
  }
}

// Add after setup function
async function showLeaderboard() {
  leaderboardUI = document.getElementById('leaderboardUI');
  document.getElementById('finalScore').textContent = score;
  leaderboardUI.style.display = 'block';
  await updateLeaderboard();
}

async function updateLeaderboard() {
  try {
    const { data, error } = await supabaseClient
      .from('highscores')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);

    if (error) throw error;

    const leaderboardHTML = data.map((entry, index) => `
      <div class="leaderboard-entry">
        <span>#${index + 1} ${entry.player_email.split('@')[0]}</span>
        <span>${entry.score}</span>
      </div>
    `).join('');

    document.getElementById('leaderboardEntries').innerHTML = leaderboardHTML;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}

async function submitScore() {
  if (isSubmittingScore) return;
  
  const emailInput = document.getElementById('playerEmail');
  const errorDiv = document.getElementById('emailError');
  const email = emailInput.value.trim();
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorDiv.textContent = 'Please enter a valid email address';
    return;
  }
  
  errorDiv.textContent = '';
  isSubmittingScore = true;

  try {
    console.log('Submitting score:', { email, score }); // Debug log
    
    const { data, error } = await supabaseClient
      .from('highscores')
      .insert([
        { player_email: email, score: score }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error); // Debug log
      throw error;
    }
    
    console.log('Score submitted successfully:', data); // Debug log
    await updateLeaderboard();
    emailInput.value = '';
    document.querySelector('.input-group').innerHTML = '<p>Score submitted successfully!</p>';
  } catch (error) {
    console.error('Error submitting score:', error);
    errorDiv.textContent = 'Error submitting score. Please try again.';
  } finally {
    isSubmittingScore = false;
  }
}