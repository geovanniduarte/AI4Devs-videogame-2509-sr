BLOWER (TAREA)

1.  PROMPT

You are an expert game developer. Your task is to set up the structure for a lightweight BLOWPIPE using Phaser 3, a popular HTML5 game framework. I don’t want to write a line of code myself, so please handle all the necessary file creation and setup. First, create the following project structure:blowpipe-GDG/  │── index.html  │── main.js        │── style.css  │── assets/  │    │── images/  │    │── audio/
Execute the necessary commands using python to create these directories and files.
Once the structure is created, populate index.html and main.js  and  style.css  and verify Phaser is correctly added.

2.  PROMPT

    1. I am creating a video game, I need you act as  the creative ui designer of my video game, I am creating a video game that consist of blowing fallen leaves, give me the image of the fallen leave in 32x32, it must reflect an orange leave that dropped because of autum.
    2. I need to create the image of a blowpipe that is going to be used to move the fallen leaves in order to clean an specific area, create me the sprite for this important object for the player, since this is going to be to object that the player moves.
    3. The game has a tree with green green, yellow and orange leaves that are about to fall, give me the sprite of the tree.



3. PROMPT

You are an expert game developer, Your task is to continue setting up the cleaner blowpipe game, We have already created the basic project structure, and the initial HTML and JavaScript files are set up. Next, we need to:

    1. For now we have the following sprites
        1. /blowpipe-GDG/assets/images/tree.png 
        2. /blowpipe-GDG/assets/images/leave.jpeg 
        3. /blowpipe-GDG/assets/images/block.png

	Create the initial scenario:
		* the floor created seen from above  in the center of the canvas created with block.png
		* a bunch of fallen leaves in the middle of the floor  waiting to be cleaned.

Create a centered floor surface enough to expand the 80% width and height of the hole game canvas, compute the amount of blocks and the scale of each one to create the matrix to comply with that, scale the leaves in order to be 8 times smaller than each block.

 3. METAPROMPT

Context:
You are an expert game developer. The project structure, HTML, and JavaScript files are already set up for the "Cleaner Blowpipe" game. The following image assets are available:
* blowpipe-GDG/assets/images/tree.png
* blowpipe-GDG/assets/images/leave.png
* blowpipe-GDG/assets/images/block.png
Next steps:
1. Create the Initial Scenario
* Draw the "floor", viewed from above, centered on the canvas using a matrix of 8x8 blocks with block.png.
* The floor must cover 80% of both the width and height of the game canvas, and be centered.
    * Ej: if the whole game canvas measures 100 x 100 pixels, the floor surface must be 80 x 80 pixels centered.
    * The remaining space around the floor surface must be filled with grass.
* Every block must be seen completely.
* The floor should be made up of a grid (matrix) of block.png tiles:
* Calculate block size (scaling as needed).
* Ensure the blocks do not overflow this area.
* Every block should be uniformly scaled.
* On top of the floor, arrange a cluster of "fallen leaves" using leave.png:
* Place a random but dense set of leaves in the middle region of the floor grid, visually indicating they’re waiting to be cleaned.
* Each individual leaf sprite should be scaled to 1/4th the width and height of a floor block (i.e., each leaf is 4 times smaller than a block in both dimensions).
Clarifications:
* Do not create the cleaning interaction yet—just set up the visual scenario.
* No need to use the tree sprite at this stage.
Deliverables:
* JavaScript code that builds and renders the described scenario on the game's canvas, meeting all positioning and scaling requirements.
* Code should be clean, readable, and modular, with comments explaining calculations.

4. PROMPT

Add the blower by blowpipe-GDG/assets/images/blower.png sprite, it can be moved left and rigth, backward and forward, the floor made of block, need to be cleaned, It means without leaves on it, leaves must go to the grass in order to get the floor cleaned. When the player press the key A, the blowpipe release pressurized directed air, the blowpipe can be moved in order to point to single or 	bunch of fallen leaves in the area to be cleaned, the tree is located near the area to be cleaned and helps to get the area to be cleaned 	dirty, Please handle all the necessary file updates and configurations to achieve this. Once done, test the game to ensure the player c	haracter can move as expected.

4. METAPROMPT

I’m building a small browser game in the project blowpipe-GDG. The main game logic is in blowpipe-GDG/main.js, and assets are under blowpipe-GDG/assets/images/. I want to add a new gameplay feature around a leaf blower.
Goal
Add a blower object using the sprite blowpipe-GDG/assets/images/blower.png with the following behavior:
1. Blower movement
        * The blower is controlled by the player.
        * It can move left/right and up/down (backward/forward) within the playable area.
        * The blower left/right/up/down just translates, no rotates.
        * Movement must feel smooth and consistent with the current game controls and wind physics.
    1. Floor and leaves
        * The floor is made of block tiles (already present in the game).
        * The floor must be considered “clean” only when there are no leaves on it.
        * Leaves initially fall and accumulate on the floor.
        * There is grass near or around the floor area; leaves should be blown from the floor to the grass area.
    2. Blowing mechanic (key A)
        * Blower nozzle is located in the left-center part of the blower sprite initially, leaves must move just in the direction of the nozzle.
        * While the player presses the A key, the blower turns on and releases pressurized directed air from its nozzle. “A” key just emits air, not move the blower, when the player stops press A key, the blower turns off and stops emitting air.
        * Any leaf (or group of leaves) within the air cone / range should be moved forward, you should keep releasing air aiming to leaves in order to pushed away completely.
        * Just leaves into the wind range must be moved, the closer is the leaf from the blower nozzle, the higher the initial leaf speed, if the blower is on, the leaves keep moving, when off, the  leaf movement speed decreases until impacted leaves stop completely.
        * After the blower is off, air is out, the leaves keep moving just for 2 seconds because of the residual wind, after that, leaves stop moving completely.
        * The direction of the air depends on the current facing / aiming direction of the blower.
        * If they are on the floor, they should be pushed towards the grass.
        * Handle both single leaves and clusters of leaves.
        * Once a leaf reaches the grass area, it should be considered removed from the floor for cleaning purposes.
        * Show an accelerator in top right of the screen that shows the power applied to the blower, the higher the power the stronger the air released by the blower, it reaches the maximum power 1 seconds after the blower is on, and power is off when the blower is off almost immediately.
        * While the blower is ON, each leaf’s speed must be a monotonic decreasing function of its distance from the nozzle: leaves closest to the nozzle move fastest, and their speed smoothly decreases the farther they are from the nozzle, reaching the minimum at the end of the wind range and finally stops when get out of the 
    3. Win/clean condition
        * Implement a simple way to check if the floor is currently clean (no leaves on it).
        * Expose this state somehow (e.g., a variable, a UI text, or a simple console log) so it’s easy to verify that cleaning logic works.
Implementation details
    * Update all necessary files, mainly blowpipe-GDG/main.js, and any other JS or asset wiring needed so the new behavior works.
    * Follow the existing code style and structure already used in main.js for:
    * sprite loading,
    * input handling,
    * update loop,
    * collision / position updates, etc.
    * Make sure the blower, leaves, floor, and grass are all rendered correctly and their interactions are visible.
What I want from you
    1. Show the updated code for all modified files, clearly indicating which file each code block belongs to.
    2. Explain briefly how:
        * blower movement works,
        * leaf blowing and movement towards grass is implemented,
        * the clean-floor state is determined.
    3. After implementing, simulate or describe how to test the game:
        * Moving the blower around.
        * Pressing A to blow leaves from floor to grass.
        * Observing that the floor becomes clean when all leaves have been removed from it.

1. PROMPT
Now add a timer that is consistent with the amount of leaves, when if the player get the flour clean before the timer ends, the player wins and the game shows up a victory message, otherwise the game is over and the game shows up a failure message with a button to start the game over again.
