import { EventBus } from "../EventBus";
import { Scene } from "phaser";

enum ItemType {
    RAW = "RAW",
    PROCESSED = "PROCESSED",
}

interface Item {
    type: ItemType;
}

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

    private playerInCarryArea: boolean = false;
    private playerInDropArea: boolean = false;
    private playerInProcessedArea: boolean = false;

    private playerCounter: Phaser.GameObjects.Text;
    private droppedCounter: Phaser.GameObjects.Text;
    private processedAreaCounter: Phaser.GameObjects.Text;

    private counterTimer?: Phaser.Time.TimerEvent;

    private isProcessing: boolean = false;

    private playerItems: Item[] = [];
    private droppedItems: Item[] = [];
    private processedItems: Item[] = [];

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
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0xe6e6e6);

        this.gameText = this.add.text(100, 100, "Player is outside box2", {
            fontSize: 15,
            color: "#ff0000",
        });

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

        // Create player as a physics rectangle
        this.player = this.add.rectangle(512, 384, 32, 32, 0xff0000);
        this.physics.add.existing(this.player, false);
        (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(
            true
        );

        // Update counter text centered on player
        this.playerCounter = this.add
            .text(this.player.x, this.player.y, "RAW: 0", {
                fontSize: "16px",
                color: "#ffffff",
            })
            .setOrigin(0.5, 0.5);

        // Create box as a physics rectangle
        this.box = this.add.rectangle(612, 384, 50, 50, 0x0000ff);
        this.physics.add.existing(this.box, true); // true makes it static (immovable)

        // Add collision between player and box
        this.physics.add.collider(this.player, this.box);

        // Replace all overlap detections with these:

        // Carry area - RAW items
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

        // Processed area - PROCESSED items
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

        // Add overlap detection for drop area
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

        // Setup WASD keys with null check
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

        // Remove the template text and reduce background opacity
        this.background = this.add.image(512, 384, "background");
        this.background.setAlpha(0.2);

        EventBus.emit("current-scene-ready", this);
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
        const rawCount = (items: Item[]) =>
            items.filter((i) => i.type === ItemType.RAW).length;
        const processedCount = (items: Item[]) =>
            items.filter((i) => i.type === ItemType.PROCESSED).length;

        this.playerCounter.setText(
            `RAW: ${rawCount(this.playerItems)} PROC: ${processedCount(this.playerItems)}`
        );
        this.droppedCounter.setText(`RAW: ${rawCount(this.droppedItems)}`);
        this.processedAreaCounter.setText(
            `PROCESSED: ${processedCount(this.processedItems)}`
        );
    }

    private carryItem(item: ItemType) {
        this.playerItems.push({ type: item });
        this.updateCounterTexts();
    }

    private dropItem() {
        if (this.playerItems.length > 0) {
            const item = this.playerItems.pop()!;
            this.droppedItems.push(item);
            this.updateCounterTexts();

            if (!this.isProcessing) {
                this.checkAndProcessItems();
            }
        } else {
            if (this.counterTimer) {
                this.counterTimer.destroy();
                this.counterTimer = undefined;
            }
        }
    }

    private checkAndProcessItems() {
        if (this.droppedItems.length > 0 && !this.isProcessing) {
            this.isProcessing = true;
            this.time.delayedCall(
                1500,
                () => {
                    // Process one item
                    const item = this.droppedItems.shift()!;
                    item.type = ItemType.PROCESSED;
                    this.processedItems.push(item);
                    this.updateCounterTexts();
                    this.isProcessing = false;

                    if (this.droppedItems.length > 0) {
                        this.checkAndProcessItems();
                    }
                },
                [],
                this
            );
        }
    }

    update() {
        if (!this.moveKeys) return;

        const speed = 200;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

        // Handle movement with velocity instead of position
        playerBody.setVelocity(0);

        // Update counter position to follow player
        this.playerCounter.setPosition(this.player.x, this.player.y);

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

    changeScene() {
        this.scene.start("GameOver");
    }
}

