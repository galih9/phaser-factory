import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { Item, ItemType } from '../types/Items';
import { ItemService } from '../services/ItemService';
import { TIMER_CONFIG, COLORS, PLAYER_SPEED as speed } from '../constants/GameConfig';

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameText: Phaser.GameObjects.Text;
    private player: Phaser.GameObjects.Rectangle;
    private moveKeys: {
        W: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };
    private box: Phaser.GameObjects.Rectangle;
    private carryArea: Phaser.GameObjects.Rectangle;
    private dropArea: Phaser.GameObjects.Rectangle;
    private processedArea: Phaser.GameObjects.Rectangle;
    private sellingArea: Phaser.GameObjects.Rectangle;

    private playerInCarryArea: boolean = false;
    private playerInDropArea: boolean = false;
    private playerInProcessedArea: boolean = false;
    private playerInSellingArea: boolean = false;

    private playerCounter: Phaser.GameObjects.Text;
    private droppedCounter: Phaser.GameObjects.Text;
    private processedAreaCounter: Phaser.GameObjects.Text;
    private coinText: Phaser.GameObjects.Text;

    private counterTimer?: Phaser.Time.TimerEvent;

    private isProcessing: boolean = false;

    private playerItems: Item[] = [];
    private droppedItems: Item[] = [];
    private processedItems: Item[] = [];

    private coins: number = 0;

    private readonly TEXT_OFFSET_Y = -40;

    constructor() {
        super({
            key: "Game",
            physics: {
                default: "arcade",
                arcade: {
                    debug: false,
                },
            },
        });
    }

    create() {
        this.setupCamera();
        this.setupAreas();
        this.setupPlayer();
        this.setupOverlaps();
        this.setupInput();
        EventBus.emit("current-scene-ready", this);
    }

    private setupCamera() {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(COLORS.BACKGROUND);
        
        // Initialize gameText
        this.gameText = this.add.text(100, 100, "Start gathering items!", {
            fontSize: "15px",
            color: "#000000",
        });

        // Add coin counter
        this.coinText = this.add.text(20, 20, "Coins: 0", {
            fontSize: "20px",
            color: "#000000",
            fontStyle: "bold"
        });
    }

    private setupAreas() {
        // Create and setup areas (carryArea, processedArea, dropArea)
        // create carryarea with physics as sensor
        this.carryArea = this.add.rectangle(300, 384, 50, 50, 0x0000ff);
        this.physics.add.existing(this.carryArea, false); // Set to false for dynamic body
        const carryAreaBody = this.carryArea.body as Phaser.Physics.Arcade.Body;
        carryAreaBody.setImmovable(true);
        // Make it a sensor so it doesn't block movement
        carryAreaBody.allowGravity = false;
        carryAreaBody.moves = false;

        // create area type processedarea
        this.processedArea = this.add.rectangle(250, 600, 40, 60, 0xffffff);
        this.physics.add.existing(this.processedArea, false);
        const processedAreaBody = this.processedArea
            .body as Phaser.Physics.Arcade.Body;
        processedAreaBody.allowGravity = false;
        processedAreaBody.moves = false;
        // Add counter text centered on processedArea
        this.processedAreaCounter = this.add
            .text(this.processedArea.x, this.processedArea.y, "PROCESSED: 0", {
                fontSize: "16px",
                color: "#000000",
            })
            .setOrigin(0.5, 0.5);

        // create dropArea with physics as sensor
        this.dropArea = this.add.rectangle(300, 600, 50, 50, 0x0000ff);
        this.physics.add.existing(this.dropArea, false); // Set to false for dynamic body
        const dropAreaBody = this.dropArea.body as Phaser.Physics.Arcade.Body;
        dropAreaBody.setImmovable(true);
        // Make it a sensor so it doesn't block movement
        dropAreaBody.allowGravity = false;
        dropAreaBody.moves = false;

        // Update counter text for drop area
        this.droppedCounter = this.add
            .text(this.dropArea.x, this.dropArea.y, "RAW: 0", {
                fontSize: "16px",
                color: "#ffffff",
            })
            .setOrigin(0.5, 0.5);

        // create sellingArea
        this.sellingArea = this.add.rectangle(700, 384, 50, 50, 0xfaf741);
        this.physics.add.existing(this.sellingArea, false); // Set to false for dynamic body
        const sellingAreaBody = this.sellingArea.body as Phaser.Physics.Arcade.Body;
        sellingAreaBody.setImmovable(true);
        // Make it a sensor so it doesn't block movement
        sellingAreaBody.allowGravity = false;
        sellingAreaBody.moves = false;
    }

    private setupPlayer() {
        this.player = this.add.rectangle(512, 384, 32, 32, COLORS.PLAYER);
        this.physics.add.existing(this.player, false);
        (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(
            true
        );

        // Update counter text centered on player with offset
        this.playerCounter = this.add
            .text(this.player.x, this.player.y + this.TEXT_OFFSET_Y, "RAW: 0", {
                fontSize: "16px",
                color: "#000000",
            })
            .setOrigin(0.5, 0.5);

        // Create box as a physics rectangle
        this.box = this.add.rectangle(612, 384, 50, 50, 0x0000ff);
        this.physics.add.existing(this.box, true); // true makes it static (immovable)

        // Add collision between player and box
        this.physics.add.collider(this.player, this.box);
    }

    private setupOverlaps() {
        this.setupCarryAreaOverlap();
        this.setupProcessedAreaOverlap();
        this.setupDropAreaOverlap();
        this.setupSellingAreaOverlap();
    }

    private setupSellingAreaOverlap() {
        this.physics.add.overlap(
            this.player,
            this.sellingArea,
            () => {
                if (!this.playerInSellingArea && this.playerItems.length > 0) {
                    this.playerInSellingArea = true;
                    this.gameText.setText("Selling items");
                    this.sellItems();
                }
            },
            undefined,
            this
        );

    }

    private setupCarryAreaOverlap() {
        this.physics.add.overlap(
            this.player,
            this.carryArea,
            () => {
                if (!this.playerInCarryArea) {
                    this.playerInCarryArea = true;
                    this.gameText.setText("Carrying RAW items");
                    if (!this.counterTimer) {
                        this.counterTimer = this.time.addEvent({
                            delay: 500,
                            callback: () => this.carryItem(ItemType.RAW),
                            callbackScope: this,
                            loop: true,
                        });
                    }
                }
            },
            undefined,
            this
        );
    }

    private setupProcessedAreaOverlap() {
        this.physics.add.overlap(
            this.player,
            this.processedArea,
            () => {
                if (!this.playerInProcessedArea && this.processedItems.length > 0) {
                    this.playerInProcessedArea = true;
                    this.gameText.setText("Picking processed items");
                    if (!this.counterTimer) {
                        this.counterTimer = this.time.addEvent({
                            delay: 500,
                            callback: this.pickProcessedItem,
                            callbackScope: this,
                            loop: true,
                        });
                    }
                }
            },
            undefined,
            this
        );
    }

    private setupDropAreaOverlap() {
        this.physics.add.overlap(
            this.player,
            this.dropArea,
            () => {
                if (!this.playerInDropArea && this.playerItems.length > 0) {
                    this.playerInDropArea = true;
                    this.gameText.setText("Dropping items");
                    if (!this.counterTimer) {
                        this.counterTimer = this.time.addEvent({
                            delay: 500,
                            callback: this.dropItem,
                            callbackScope: this,
                            loop: true,
                        });
                    }
                }
            },
            undefined,
            this
        );
    }

    private pickProcessedItem = () => {
        if (this.processedItems.length > 0) {
            const item = this.processedItems.pop()!;
            this.playerItems.push(item);
            this.updateCounterTexts();
        } else {
            this.stopTimer();
        }
    }

    private updateCounterTexts() {
        const playerCounts = ItemService.countItems(this.playerItems);
        const droppedCounts = ItemService.countItems(this.droppedItems);
        const processedCounts = ItemService.countItems(this.processedItems);

        this.playerCounter.setText(ItemService.formatCounterText(playerCounts));
        this.droppedCounter.setText(`RAW: ${droppedCounts.raw}`);
        this.processedAreaCounter.setText(`PROCESSED: ${processedCounts.processed}`);
    }

    private carryItem(type: ItemType) {
        this.playerItems.push(ItemService.createItem(type));
        this.updateCounterTexts();
    }

    private dropItem() {
        if (this.playerItems.length > 0) {
            const item = this.playerItems.pop()!;
            this.droppedItems.push(item);
            this.updateCounterTexts();

            if (!this.isProcessing) {
                this.processItems();
            }
        } else {
            this.stopTimer();
        }
    }

    private processItems() {
        if (this.droppedItems.length > 0 && !this.isProcessing) {
            this.isProcessing = true;
            this.time.delayedCall(
                TIMER_CONFIG.PROCESS_DELAY,
                () => {
                    const item = this.droppedItems.shift()!;
                    this.processedItems.push(ItemService.processItem(item));
                    this.updateCounterTexts();
                    this.isProcessing = false;

                    if (this.droppedItems.length > 0) {
                        this.processItems();
                    }
                },
                [],
                this
            );
        }
    }

    private sellItems() {
        const rawItems = this.playerItems.filter(item => item.type === ItemType.RAW);
        const processedItems = this.playerItems.filter(item => item.type === ItemType.PROCESSED);
        
        const rawValue = rawItems.length * 5;
        const processedValue = processedItems.length * 15;
        
        this.coins += (rawValue + processedValue);
        this.coinText.setText(`Coins: ${this.coins}`);
        
        // Clear player's inventory
        this.playerItems = [];
        this.updateCounterTexts();
    }

    update() {
        if (!this.moveKeys) return;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

        // Handle movement with velocity instead of position
        playerBody.setVelocity(0);

        // Update counter position to follow player with offset
        this.playerCounter.setPosition(this.player.x, this.player.y + this.TEXT_OFFSET_Y);

        // Update area checks:
        if (this.playerInCarryArea && !this.physics.overlap(this.player, this.carryArea)) {
            this.playerInCarryArea = false;
            this.gameText.setText("Outside carry area");
            this.stopTimer();
        }

        if (this.playerInProcessedArea && !this.physics.overlap(this.player, this.processedArea)) {
            this.playerInProcessedArea = false;
            this.gameText.setText("Outside processed area");
            this.stopTimer();
        }

        if (this.playerInDropArea && !this.physics.overlap(this.player, this.dropArea)) {
            this.playerInDropArea = false;
            this.gameText.setText("Outside drop area");
            this.stopTimer();
        }

        // Add selling area exit check
        if (this.playerInSellingArea && !this.physics.overlap(this.player, this.sellingArea)) {
            this.playerInSellingArea = false;
            this.gameText.setText("Outside selling area");
        }

        if (this.moveKeys.W?.isDown) {
            playerBody.setVelocityY(-speed);
        }
        if (this.moveKeys.S?.isDown) {
            playerBody.setVelocityY(speed);
        }
        if (this.moveKeys.A?.isDown) {
            playerBody.setVelocityX(-speed);
        }
        if (this.moveKeys.D?.isDown) {
            playerBody.setVelocityX(speed);
        }
    }

    private stopTimer() {
        if (this.counterTimer) {
            this.counterTimer.destroy();
            this.counterTimer = undefined;
        }
    }

    private setupInput() {
        if (this.input.keyboard) {
            this.moveKeys = this.input.keyboard.addKeys({
                W: Phaser.Input.Keyboard.KeyCodes.W,
                S: Phaser.Input.Keyboard.KeyCodes.S,
                A: Phaser.Input.Keyboard.KeyCodes.A,
                D: Phaser.Input.Keyboard.KeyCodes.D,
            }) as {
                W: Phaser.Input.Keyboard.Key;
                S: Phaser.Input.Keyboard.Key;
                A: Phaser.Input.Keyboard.Key;
                D: Phaser.Input.Keyboard.Key;
            };
        } else {
            console.warn("Keyboard input is not available");
        }
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}

