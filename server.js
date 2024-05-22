const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let players = {};
let readyPlayers = [];
let wins = { blue: 0, red: 0 };

io.on('connection', (socket) => {
    console.log(`Nuova connessione: ${socket.id}`);

    socket.on('playerReady', (username) => {
        if (!players[socket.id]) {
            players[socket.id] = {
                username: username,
                color: Object.keys(players).length === 0 ? 'blue' : 'red',
                snake: Object.keys(players).length === 0 ?
                    [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }] :
                    [{ x: 15, y: 15 }, { x: 14, y: 15 }, { x: 13, y: 15 }],
                direction: 'right',
                grow: false
            };
        }

        if (!readyPlayers.includes(socket.id)) {
            readyPlayers.push(socket.id);
        }

        if (readyPlayers.length === 2) {
            startGame();
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            const { direction } = movementData;
            const currentDirection = players[socket.id].direction;

            if (
                (currentDirection === 'right' && direction === 'left') ||
                (currentDirection === 'left' && direction === 'right') ||
                (currentDirection === 'up' && direction === 'down') ||
                (currentDirection === 'down' && direction === 'up')
            ) {
                return;
            }

            players[socket.id].direction = direction;
        }
    });

    socket.on('disconnect', () => {
        console.log(`Giocatore disconnesso: ${socket.id}`);
        delete players[socket.id];
        const index = readyPlayers.indexOf(socket.id);
        if (index !== -1) {
            readyPlayers.splice(index, 1);
        }
        io.emit('disconnect', socket.id);
    });
});

function startGame() {
    io.emit('startTimer');

    setTimeout(() => {
        io.emit('startGame', { players, wins });
        gameLoop();
        setInterval(() => {
            growSnakes();
        }, 2000);
    }, 3000);
}

function gameLoop() {
    const interval = setInterval(() => {
        const playerIds = Object.keys(players);

        playerIds.forEach((playerId) => {
            const player = players[playerId];
            const head = { ...player.snake[0] };

            if (player.direction === 'right') head.x++;
            if (player.direction === 'left') head.x--;
            if (player.direction === 'up') head.y--;
            if (player.direction === 'down') head.y++;

            player.snake.unshift(head);

            if (head.x < 0 || head.y < 0 || head.x >= 30 || head.y >= 30) {
                handleCollision(playerId);
                clearInterval(interval);
                return;
            }

            for (let i = 1; i < player.snake.length; i++) {
                if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
                    handleCollision(playerId);
                    clearInterval(interval);
                    return;
                }
            }

            playerIds.forEach((id) => {
                if (id !== playerId) {
                    players[id].snake.forEach((segment, index) => {
                        if (index === 0 && segment.x === head.x && segment.y === head.y) {
                            handleSnakeCollision(playerId, id);
                            clearInterval(interval);
                            return;
                        }
                        if (index > 0 && segment.x === head.x && segment.y === head.y) {
                            handleCollision(playerId);
                            clearInterval(interval);
                            return;
                        }
                    });
                }
            });

            if (!player.grow) {
                player.snake.pop();
            } else {
                player.grow = false;
            }
        });

        io.emit('gameState', { players, wins });
    }, 100);
}

function handleCollision(playerId) {
    const opponentId = Object.keys(players).find(id => id !== playerId);
    wins[players[opponentId].color]++;
    if (wins[players[opponentId].color] === 3) {
        io.emit('finalWinner', { winner: players[opponentId].username });
    } else {
        resetPlayers();
        startGame();
    }
}

function handleSnakeCollision(playerId, opponentId) {
    wins[players[opponentId].color]++;
    if (wins[players[opponentId].color] === 3) {
        io.emit('finalWinner', { winner: players[opponentId].username });
    } else {
        resetPlayers();
        startGame();
    }
}

function resetPlayers() {
    Object.keys(players).forEach((socketId, index) => {
        players[socketId].snake = index === 0 ?
            [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }] :
            [{ x: 15, y: 15 }, { x: 14, y: 15 }, { x: 13, y: 15 }];
        players[socketId].direction = 'right';
        players[socketId].grow = false;
    });
}

function growSnakes() {
    Object.keys(players).forEach(playerId => {
        players[playerId].grow = true;
    });
}

const listener = server.listen(process.env.PORT || 3000, () => {
    console.log(`La tua app è in ascolto sulla porta ${listener.address().port}`);
});
