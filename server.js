const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Dale and Jansson multiplayer-server fungerar!");
});

const wss = new WebSocket.Server({
    server
});

const rooms = new Map();

function createRoomCode() {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];
        }

    } while (rooms.has(code));

    return code;
}

function send(player, data) {
    if (
        player &&
        player.readyState === WebSocket.OPEN
    ) {
        player.send(
            JSON.stringify(data)
        );
    }
}

function broadcast(room, data) {
    for (const player of room.players) {
        send(player.socket, data);
    }
}

wss.on("connection", (socket) => {

    console.log("En spelare anslöt.");

    let player = {
    socket: socket,

    room: null,

    id:
        Math.random()
            .toString(36)
            .substring(2, 10),

    // Spelarens position
    x: 0,
    y: 1,
    z: 0,

    // Spelarens riktning
    rotation: 0
};

    socket.on("message", (message) => {

        let data;

        try {
            data = JSON.parse(
                message.toString()
            );
        } catch {
            return;
        }

        // =========================
        // SKAPA RUM
        // =========================

        if (data.type === "createRoom") {

            if (player.room) {
                return;
            }

            const code =
                createRoomCode();

            const room = {
                code: code,
                players: []
            };

            rooms.set(
                code,
                room
            );

            room.players.push(
                player
            );

            player.room = room;

            send(player.socket, {
                type: "roomCreated",
                roomCode: code,
                playerId: player.id
            });

            console.log(
                `Rum skapat: ${code}`
            );

            return;
        }


        // =========================
        // GÅ MED I RUM
        // =========================

        if (data.type === "joinRoom") {

            if (player.room) {
                return;
            }

            const code =
                String(
                    data.roomCode || ""
                )
                .trim()
                .toUpperCase();

            const room =
                rooms.get(code);

            if (!room) {

                send(player.socket, {
                    type: "error",
                    message:
                        "Rummet finns inte."
                });

                return;
            }

            if (room.players.length >= 8) {
                
                send(player.socket, {
                    type: "error",
                    message:
                        "Rummet är fullt."
                });

                return;
            }

            room.players.push(
                player
            );

            player.room = room;

            send(player.socket, {
                type: "joinedRoom",
                roomCode: code,
                playerId: player.id
            });

            broadcast(room, {
                type: "roomPlayers",
                count:
                    room.players.length
            });

// Skicka alla befintliga spelare
// till den nya spelaren

for (
    const otherPlayer of room.players
) {

    send(player.socket, {
        type: "playerJoined",
        playerId:
            otherPlayer.id,

        x:
            otherPlayer.x,

        y:
            otherPlayer.y,

        z:
            otherPlayer.z,

        rotation:
            otherPlayer.rotation
    });

}

            console.log(
                `Spelare gick med i ${code}`
            );

            return;
        }

    });

// =========================
// SPELARE RÖR SIG
// =========================

if (data.type === "playerMove") {

    if (!player.room) {
        return;
    }


    // Spara positionen

    if (
        typeof data.x === "number"
    ) {

        player.x =
            data.x;

    }

    if (
        typeof data.y === "number"
    ) {

        player.y =
            data.y;

    }

    if (
        typeof data.z === "number"
    ) {

        player.z =
            data.z;

    }

    if (
        typeof data.rotation ===
        "number"
    ) {

        player.rotation =
            data.rotation;

    }


    // Skicka positionen
    // till de andra spelarna

    for (
        const otherPlayer of
        player.room.players
    ) {

        if (
            otherPlayer ===
            player
        ) {
            continue;
        }

        send(
            otherPlayer.socket,
            {
                type:
                    "playerMove",

                playerId:
                    player.id,

                x:
                    player.x,

                y:
                    player.y,

                z:
                    player.z,

                rotation:
                    player.rotation
            }
        );

    }

    return;
}

    // =========================
    // SPELARE LÄMNAR
    // =========================

    socket.on("close", () => {

        console.log(
            "En spelare lämnade."
        );

        if (!player.room) {
            return;
        }

        const room =
            player.room;

        room.players =
            room.players.filter(
                p => p !== player
            );

        broadcast(room, {
            type: "roomPlayers",
            count:
                room.players.length
        });

        if (
            room.players.length === 0
        ) {
            rooms.delete(
                room.code
            );

            console.log(
                `Rum borttaget: ${room.code}`
            );
        }
    });

});


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server kör på port ${PORT}`
        );

    }
);
