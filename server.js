const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const db = mysql.createConnection({
    host: 'database-test.c4xgxkzb2pfl.us-east-1.rds.amazonaws.com',
    user: 'team',
    password: 'sidelinesteam',
    database: 'teams',
});


const fetchUpcomingGames = async () => {
    try {
        const response = await axios.get('https://sql-api-wp-be.sidelines.io/games/upcoming/nba');
        const upcomingGames = response.data;
        const gamesArray = upcomingGames.data;

        const filterGamesArray = gamesArray.filter((games) => games.away_consensus_line != null && games.home_consensus_line != null && games.isEverGreen == true);

        for (let i = 0; i < filterGamesArray.length; i++) {
            const game = gamesArray[i];

            const sql = `
                INSERT INTO games
                (game_key, game_date, game_time, away_team_abbr, home_team_abbr, status, league_name, away_consensus_line, home_consensus_line)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                game_date = VALUES(game_date),
                game_time = VALUES(game_time),
                away_team_abbr = VALUES(away_team_abbr),
                home_team_abbr = VALUES(home_team_abbr),
                status = VALUES(status),
                league_name = VALUES(league_name),
                away_consensus_line = VALUES(away_consensus_line),
                home_consensus_line = VALUES(home_consensus_line);
          `;

            const values = [
                game.game_key,
                game.game_date,
                game.game_time,
                game.away_team_abbr,
                game.home_team_abbr,
                game.status,
                game.league_name,
                game.away_consensus_line,
                game.home_consensus_line,
            ];

            await db.query(sql, values);
        }
    } catch (error) {
        console.error('Error fetching games:', error.message);
    }
};

app.get('/games-info', (req, res) => {
    const smallestQuery = `
        SELECT game_key, ABS (away_consensus_line - home_consensus_line) as ratio
        FROM games ORDER BY ratio ASC LIMIT 1
    `;

    db.query(smallestQuery, (error, results) => {
        console.log(results)

        if (error) {
            console.error('Error retrieving game information:', error.message);
            res.status(500).json({error: 'Internal Server Error'});
            return;
        }

        if (results.length === 0) {
            res.status(404).json({message: 'No game information found.'});
            return;
        }

        const smallestGame = {
            gameKey: results[0].game_key,
            type: 'smallest',
            ratio: results[0].ratio,
        };

        const largestQuery = `
            SELECT game_key, ABS(away_consensus_line - home_consensus_line) AS ratio
            FROM games ORDER BY ratio DESC LIMIT 1
        `;

        db.query(largestQuery, (error, results) => {
            if (error) {
                console.error('Error retrieving largest game information:', err.message);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            if (results.length === 0) {
                res.status(404).json({ message: 'No game information found.' });
                return;
            }

            const largestGame = {
                gameKey: results[0].game_key,
                type: 'largest',
                ratio: results[0].ratio,
            };

            res.json([smallestGame, largestGame]);
        });
    });
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        process.exit(1);
    }

    console.log('Connected to MySQL database.');

    fetchUpcomingGames().then(r => r);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});