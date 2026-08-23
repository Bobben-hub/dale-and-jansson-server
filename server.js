const http = require("http");
const WebSocket = require("ws");

const PORT =
    process.env.PORT || 3000;


// ========================================
// HTTP SERVER
// ========================================

const server =
    http.createServer(
        (req, res) => {

            res.writeHead(
                200,
                {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                }
            );

            res.end(
                "Dale and Jansson multiplayer-server fungerar!"
            );

        }
    );


// ========================================
// WEBSOCKET SERVER
// ========================================

const wss =
    new WebSocket.Server({
        server
    });


// ========================================
// ROOMS
// ========================================

const rooms =
    new Map();


// ========================================
// CREATE ROOM CODE
// ========================================

function createRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (
            let i = 0;
            i < 6;
            i++
        ) {

            code +=
                characters[
                    Math.floor(
                        Math.random() *
                        characters.length
                    )
                ];

        }

    } while (
        rooms.has(code)
    );

    return code;

}


// ========================================
// SEND
// ========================================

function send(
    socket,
    data
) {

    if (
        socket &&
        socket.readyState ===
        WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(data)
        );

    }

}


// ========================================
// BROADCAST
// ========================================

function broadcast(
    room,
    data
) {

    for (
        const player of room.players
    ) {

        send(
            player.socket,
            data
        );

    }

}


// ========================================
// PLAYER CONNECTION
// ========================================

wss.on(
    "connection",
    (socket) => {

        console.log(
            "En spelare anslöt."
        );


        // ========================================
        // PLAYER DATA
        // ========================================

        const player = {

            socket:

                socket,

            room:

                null,

            id:

                Math.random()
                    .toString(36)
                    .substring(
                        2,
                        10
                    ),

            x: 0,

            y: 1,

            z: 0,

            rotation: 0

        };


        // ========================================
        // MESSAGES
        // ========================================

        socket.on(
            "message",
            (message) => {

                let data;


                try {

                    data =
                        JSON.parse(
                            message.toString()
                        );

                } catch {

                    return;

                }


                // ========================================
                // CREATE ROOM
                // ========================================

                if (
                    data.type ===
                    "createRoom"
                ) {

                    if (
                        player.room
                    ) {

                        return;

                    }


                    const code =
                        createRoomCode();


                    const room = {

                        code:

                            code,

                        players:

                            []

                    };


                    rooms.set(
                        code,
                        room
                    );


                    room.players.push(
                        player
                    );


                    player.room =
                        room;


                    send(
                        player.socket,
                        {

                            type:
                                "roomCreated",

                            roomCode:
                                code,

                            playerId:
                                player.id

                        }
                    );


                    console.log(
                        `Rum skapat: ${code}`
                    );


                    return;

                }


                // ========================================
                // JOIN ROOM
                // ========================================

                if (
                    data.type ===
                    "joinRoom"
                ) {

                    if (
                        player.room
                    ) {

                        return;

                    }


                    const code =
                        String(
                            data.roomCode ||
                            ""
                        )
                        .trim()
                        .toUpperCase();


                    const room =
                        rooms.get(
                            code
                        );


                    if (
                        !room
                    ) {

                        send(
                            player.socket,
                            {

                                type:
                                    "error",

                                message:
                                    "Rummet finns inte."

                            }
                        );

                        return;

                    }


                    if (
                        room.players.length >=
                        8
                    ) {

                        send(
                            player.socket,
                            {

                                type:
                                    "error",

                                message:
                                    "Rummet är fullt."

                            }
                        );

                        return;

                    }


                    room.players.push(
                        player
                    );


                    player.room =
                        room;


                    send(
                        player.socket,
                        {

                            type:
                                "joinedRoom",

                            roomCode:
                                code,

                            playerId:
                                player.id

                        }
                    );


                    broadcast(
                        room,
                        {

                            type:
                                "roomPlayers",

                            count:
                                room.players.length

                        }
                    );


                    // ========================================
                    // SEND EXISTING PLAYERS
                    // ========================================

                    for (
                        const otherPlayer
                        of room.players
                    ) {

                        if (
                            otherPlayer ===
                            player
                        ) {

                            continue;

                        }


                        send(
                            player.socket,
                            {

                                type:
                                    "playerJoined",

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

                            }
                        );

                    }


                    // Berätta för de andra
                    // att den nya spelaren kommit

                    for (
                        const otherPlayer
                        of room.players
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
                                    "playerJoined",

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


                    console.log(
                        `Spelare gick med i ${code}`
                    );


                    return;

                }


                // ========================================
                // PLAYER MOVEMENT
                // ========================================

                if (
                    data.type ===
                    "playerMove"
                ) {

                    if (
                        !player.room
                    ) {

                        return;

                    }


                    // Position

                    if (
                        typeof data.x ===
                        "number"
                    ) {

                        player.x =
                            data.x;

                    }


                    if (
                        typeof data.y ===
                        "number"
                    ) {

                        player.y =
                            data.y;

                    }


                    if (
                        typeof data.z ===
                        "number"
                    ) {

                        player.z =
                            data.z;

                    }


                    // Rotation

                    if (
                        typeof data.rotation ===
                        "number"
                    ) {

                        player.rotation =
                            data.rotation;

                    }


                    // Skicka till de andra

                    for (
                        const otherPlayer
                        of player.room.players
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

            }
        );


        // ========================================
        // PLAYER LEAVES
        // ========================================

        socket.on(
            "close",
            () => {

                console.log(
                    "En spelare lämnade."
                );


                if (
                    !player.room
                ) {

                    return;

                }


                const room =
                    player.room;


                room.players =
                    room.players.filter(
                        p =>
                            p !== player
                    );


                // Berätta nya antalet

                broadcast(
                    room,
                    {

                        type:
                            "roomPlayers",

                        count:
                            room.players.length

                    }
                );


                // Berätta att spelaren försvann

                broadcast(
                    room,
                    {

                        type:
                            "playerLeft",

                        playerId:
                            player.id

                    }
                );


                if (
                    room.players.length ===
                    0
                ) {

                    rooms.delete(
                        room.code
                    );


                    console.log(
                        `Rum borttaget: ${room.code}`
                    );

                }

            }
        );

    }
);


// ========================================
// START SERVER
// ========================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server kör på port ${PORT}`
        );

    }
);
