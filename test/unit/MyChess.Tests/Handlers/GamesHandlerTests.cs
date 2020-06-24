﻿using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using MyChess.Data;
using MyChess.Handlers;
using MyChess.Interfaces;
using MyChess.Tests.Handlers.Stubs;
using Xunit;

namespace MyChess.Tests.Handlers
{
    public class GamesHandlerTests
    {
        private readonly GamesHandler _gamesHandler;
        private readonly MyChessContextStub _context;
        private readonly NotificationHandlerStub _notificationHandler;

        public GamesHandlerTests()
        {
            _context = new MyChessContextStub();
            _notificationHandler = new NotificationHandlerStub();
            var chessBoard = new ChessBoard(NullLogger<ChessBoard>.Instance);
            _gamesHandler = new GamesHandler(NullLogger<GamesHandler>.Instance, _context, _notificationHandler, chessBoard);
        }

        [Fact]
        public async Task Get_Games_As_New_User_No_Games()
        {
            // Arrange
            var expected = 0;
            var user = new AuthenticatedUser()
            {
                Name = "abc",
                PreferredUsername = "a b",
                UserIdentifier = "u",
                ProviderIdentifier = "p"
            };

            // Act
            var actual = await _gamesHandler.GetGamesAsync(user);

            // Assert
            Assert.Equal(expected, actual.Count);
        }

        [Fact]
        public async Task Get_Games_As_Existing_User_With_Game()
        {
            // Arrange
            var expected = "123";
            var user = new AuthenticatedUser()
            {
                Name = "abc",
                PreferredUsername = "a b",
                UserIdentifier = "u",
                ProviderIdentifier = "p"
            };

            var compactor = new Compactor();
            await _context.UpsertAsync(TableNames.Users, new UserEntity()
            {
                PartitionKey = "u",
                RowKey = "p",
                UserID = "user123"
            });
            await _context.UpsertAsync(TableNames.GamesWaitingForYou, new GameEntity()
            {
                PartitionKey = "user123",
                RowKey = "123",
                Data = compactor.Compact(new MyChessGame() { ID = "123" })
            });

            // Act
            var actual = await _gamesHandler.GetGameAsync(user, "123");

            // Assert
            Assert.NotNull(actual);
            Assert.Equal(expected, actual?.ID);
        }

        [Fact]
        public async Task Create_New_Game_But_No_Opponent_Found()
        {
            // Arrange
            var expected = "2103"; // GameHandlerOpponentNotFound
            var user = new AuthenticatedUser()
            {
                Name = "abc",
                PreferredUsername = "a b",
                UserIdentifier = "u",
                ProviderIdentifier = "p"
            };

            var gameToCreate = new MyChessGame();

            // Act
            var actual = await _gamesHandler.CreateGameAsync(user, gameToCreate);

            // Assert
            Assert.Null(actual.Game);
            Assert.NotNull(actual.Error);
            Assert.EndsWith(expected, actual.Error?.Instance);
        }

        [Fact]
        public async Task Create_New_Game()
        {
            // Arrange
            var expectedWhitePlayer = "user123";
            var expectedBlackPlayer = "user456";

            var user = new AuthenticatedUser()
            {
                Name = "abc",
                PreferredUsername = "a b",
                UserIdentifier = "u1",
                ProviderIdentifier = "p1"
            };

            // Player creating the game
            await _context.UpsertAsync(TableNames.Users, new UserEntity()
            {
                PartitionKey = "u1",
                RowKey = "p1",
                UserID = "user123"
            });

            // Opponent
            await _context.UpsertAsync(TableNames.Users, new UserEntity()
            {
                PartitionKey = "u2",
                RowKey = "p2",
                UserID = "user456"
            });
            await _context.UpsertAsync(TableNames.UserID2User, new UserID2UserEntity()
            {
                PartitionKey = "user456",
                RowKey = "user456",
                UserPrimaryKey = "u2",
                UserRowKey = "p2"
            });
            var gameToCreate = new MyChessGame();
            gameToCreate.Players.Black.ID = "user456";

            // Act
            var actual = await _gamesHandler.CreateGameAsync(user, gameToCreate);

            // Assert
            Assert.Null(actual.Error);
            Assert.NotNull(actual.Game);
            Assert.Equal(expectedWhitePlayer, actual.Game?.Players.White.ID);
            Assert.Equal(expectedBlackPlayer, actual.Game?.Players.Black.ID);
        }
    }
}
