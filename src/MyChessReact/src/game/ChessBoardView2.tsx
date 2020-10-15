import { ChessBoard } from "./ChessBoard";
import { ChessMove } from "./ChessMove";
import { ChessBoardPiece } from "./ChessBoardPiece";
import { ChessPiece } from "./ChessPiece";
import { ChessBoardState } from "./ChessBoardState";
import { MyChessGame } from "../models/MyChessGame";
import { ChessPlayer } from "./ChessPlayer";
import { setTimeout } from "timers";
import { QueryStringParser } from "../helpers/QueryStringParser";
import { MyChessGameMove } from "../models/MyChessGameMove";
import { Database, DatabaseFields } from "../data/Database";
import { GameStateFilter } from "../models/GameStateFilter";
import { getAppInsights } from "../components/TelemetryService";
import React, { useCallback, useEffect, useState } from "react";
import { UserSettings } from "../models/UserSettings";

export function ChessBoardView2() {
    const [game, setGame] = useState(new MyChessGame());
    const [board, setBoard] = useState(new ChessBoard());
    const [previousAvailableMoves, setPreviousAvailableMoves] = useState<Array<ChessMove>>([]);
    const [currentMoveNumber, setCurrentMoveNumber] = useState(0);

    const [isLocalGame, setLocalGame] = useState(true);
    const [isNewGame, setNewGame] = useState(false);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [friendID, setFriendID] = useState("");
    const [start, setStart] = useState(new Date().toISOString());

    const me = Database.get<UserSettings>(DatabaseFields.ME_SETTINGS);

    let waitingForConfirmation = false;

    const [pieceSize, setPieceSize] = useState(45);

    let ai = getAppInsights();

    const undo = () => {
        let commentDialogElement = document.getElementById("commentDialog");
        if (commentDialogElement !== null) {
            commentDialogElement.style.display = "none";
        }

        board.undo();
    }

    const cancel = (): void => {
        console.log("cancel");

        ai.trackEvent({
            name: "Play-Cancel"
        });

        showError("");
        showConfirmationDialog(false);
        showPromotionDialog(false);
        undo();
    }

    const showConfirmationDialog = (show: boolean) => {
        waitingForConfirmation = show;
        let confirmationDialogElement = document.getElementById("confirmation");
        if (confirmationDialogElement !== null) {
            confirmationDialogElement.style.display = show ? "inline" : "none";
            setDialogOpen(true);
        }
    }

    const showPromotionDialog = (show: boolean) => {
        waitingForConfirmation = show;
        let promotionDialogElement = document.getElementById("promotionDialog");
        if (promotionDialogElement !== null) {
            promotionDialogElement.style.display = show ? "inline" : "none";
        }
    }

    const showGameNameDialog = (show: boolean) => {
        waitingForConfirmation = show;
        let gameNameDialogElement = document.getElementById("gameNameDialog");
        if (gameNameDialogElement !== null) {
            gameNameDialogElement.style.display = show ? "inline" : "none";
            if (show) {
                gameNameDialogElement.scrollIntoView();
                gameNameDialogElement.focus();
            }
        }
    }

    const showError = (message: string) => {
        let element = document.getElementById("error");
        if (element !== null) {
            const show = message.length > 0;
            element.style.display = show ? "inline" : "none";
            if (show) {
                element.innerHTML = message;
                element.scrollIntoView();
                element.focus();
            }
        }
    }

    const showCommentDialog = (show: boolean) => {
        waitingForConfirmation = show;
        let commentDialogElement = document.getElementById("commentDialog");
        if (commentDialogElement !== null) {
            commentDialogElement.style.display = show ? "inline" : "none";
            if (show) {
                commentDialogElement.scrollIntoView();
                commentDialogElement.focus();
            }
        }
    }

    const showSpinner = (show: boolean) => {
        let element = document.getElementById("Loading");
        if (element !== null) {
            element.style.display = show ? "inline-flex" : "none";
            if (show) {
                element.scrollIntoView();
                element.focus();
            }
        }
    }

    const pieceSelected = (event: React.MouseEvent<HTMLTableDataCellElement> | undefined, id: string) => {
        if (waitingForConfirmation) {
            console.log("Waiting for confirmation");
            return;
        }

        if (game !== null && game.moves !== null &&
            game.moves.length !== currentMoveNumber) {
            console.log(`Not in last move: ${game.moves.length} <> ${currentMoveNumber}`);
            return;
        }

        if (!isLocalGame && !isNewGame) {
            if (board.currentPlayer === ChessPlayer.White &&
                game.players.white.id !== me?.id) {
                console.log(`Not current players turn. Player is ${me?.id} and turn is on player ${game.players.white.id}`);
                return;
            }
            else if (board.currentPlayer === ChessPlayer.Black &&
                game.players.black.id !== me?.id) {
                console.log(`Not current players turn. Player is ${me?.id} and turn is on player ${game.players.black.id}`);
                return;
            }
        }

        if (!isLocalGame && game.state === "Resigned") {
            console.log(`Game state is readonly due to state: ${game.state}`);
            return;
        }

        let rowIndex: number = parseInt(id[0]);
        let columnIndex: number = parseInt(id[2]);
        let identifier = rowIndex + "-" + columnIndex;

        if (columnIndex >= ChessBoard.BOARD_SIZE ||
            rowIndex >= ChessBoard.BOARD_SIZE) {
            console.log("Only de-select the current selection");
            return;
        }

        if (previousAvailableMoves.length > 0) {

            let selectedMove: ChessMove | null = null;
            for (let i = 0; i < previousAvailableMoves.length; i++) {
                let move: ChessMove = previousAvailableMoves[i];
                let moveId: string = move.to.verticalLocation + "-" + move.to.horizontalLocation;
                if (moveId === identifier) {
                    selectedMove = move;
                }
            }

            setPreviousAvailableMoves([]);
            if (selectedMove !== null) {
                // Make selected move
                board.makeMove(selectedMove, true);

                if (board.lastMovePromotion() !== null) {

                    let queenPromotionElement = document.getElementById("promotionRadioQueen") as HTMLInputElement;
                    queenPromotionElement.checked = true;

                    showError("");
                    showPromotionDialog(true);
                }
                else {
                    // setBoardStatus(0, 0);

                    showError("");
                    showConfirmationDialog(true);
                }

                setBoard(board);
                return;
            }
        }

        let moves: ChessMove[] = board.getAvailableMoves(columnIndex, rowIndex);
        setPreviousAvailableMoves(moves);
    }

    useEffect(() => {
        const resizeHandler = () => {
            const table = document.getElementById("table-game") as HTMLTableElement;
            if (table) {
                const width = Math.floor(window.innerWidth * 0.95);
                const height = Math.floor(window.innerHeight * 0.75);
                const size = Math.min(width, height);
                table.style.width = size + "px";
                table.style.height = size + "px";
                setPieceSize(Math.floor(size / 8))
            }
        }

        const click = (event: MouseEvent) => {
            if (!event.defaultPrevented) {
                // Add "de-selection" when clicking outside the board
                setPreviousAvailableMoves([]);
            }
        }

        resizeHandler();
        document.addEventListener("click", click);
        // document.addEventListener('keyup', keyup);
        window.addEventListener('resize', resizeHandler);

        return () => {
            document.removeEventListener("click", click);
            // document.removeEventListener('keyup', keyup);
            window.removeEventListener('resize', resizeHandler);;
        }
    }, [setPieceSize, setPreviousAvailableMoves]);

    const changePromotionFromString = useCallback((name: string): boolean => {
        console.log("changePromotionFromString to " + name);

        ai.trackEvent({
            name: "Play-Promotion", properties: {
                type: name,
            }
        });

        if (name === "Queen") {
            // No changes to promotion
            return false;
        }
        else if (name === "Knight") {
            board.changePromotion(ChessPiece.Knight);
        }
        else if (name === "Rook") {
            board.changePromotion(ChessPiece.Rook);
        }
        else if (name === "Bishop") {
            board.changePromotion(ChessPiece.Bishop);
        }
        return true;
    }, [board, ai]);

    const makeMove = useCallback((move: string, promotion: string) => {
        console.log("Making move " + move + " with promotion " + promotion);
        board.makeMoveFromString(move);
        if (promotion !== undefined && promotion.length > 0) {
            changePromotionFromString(promotion);
        }
    }, [board, changePromotionFromString]);

    const makeNumberOfMoves = useCallback((game: MyChessGame, movesCount: number): number => {
        let count = Math.min(game.moves.length, movesCount);
        console.log("going to make " + count + " moves");

        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let move = game.moves[i];
                let promotion = move.promotion !== null ? move.promotion : "";
                makeMove(move.move, promotion);
            }
            // setBoardStatus(count, game.moves.length);

            let move = game.moves[count - 1];

            const start = Date.parse(move.start);
            const end = Date.parse(move.end);

            // setThinkTime(count, end - start);
            // setComment(move.comment);
        }
        else {
            // setThinkTime(0, -1);
            // setComment("");
        }

        return count;
    }, [makeMove]);

    useEffect(() => {
        console.log("USE EFFECT - " + new Date());
        const path = window.location.pathname;
        const query = window.location.search;
        const queryString = QueryStringParser.parse(query);

        if (path.indexOf("/local") !== -1) {
            console.log("local game");
            setLocalGame(true);

            ai.trackEvent({
                name: "Play-NewGame", properties: {
                    isLocalGame: true,
                }
            });

            const json = Database.get<string>(DatabaseFields.GAMES_LOCAL_GAME_STATE);
            if (json) {
                // Try to load game state from previously stored state
                try {
                    const gameLoaded = JSON.parse(json) as MyChessGame;
                    if (JSON.stringify(game) !== json) {
                        console.log(gameLoaded);

                        const num = makeNumberOfMoves(gameLoaded, gameLoaded.moves.length);
                        setGame(gameLoaded);
                        setCurrentMoveNumber(num);
                    }
                } catch (error) {
                    console.log(error);
                    ai.trackException({ exception: error });
                }
            }
        }
        else {
            setLocalGame(false);
            if (path.indexOf("/new") !== -1) {

                ai.trackEvent({
                    name: "Play-NewGame", properties: {
                        isLocalGame: false,
                    }
                });

                console.log("new game");
                setNewGame(true);
                const friendIDParameter = queryString.get("friendID");
                if (friendIDParameter) {
                    setFriendID(friendIDParameter);
                }
                else {
                    throw new Error("Required parameter for friend is missing!");
                }
            }
            else {
                console.log("existing game");
            }
        }
    }, [game, ai, makeNumberOfMoves]);

    // private keyupHandler(event: KeyboardEvent) {

    //     if (this.isDialogOpen) {
    //         return;
    //     }

    //     switch (event.keyCode) {
    //         case 36: // Home
    //             this.firstMove();
    //             break;
    //         case 37: // LeftArrow
    //         case 40: // DownArrow
    //             this.previousMove();
    //             break;
    //         case 39: // RightArrow
    //         case 38: // UpArrow
    //             this.nextMove();
    //             break;
    //         case 35: // End
    //             this.lastMove();
    //             break;
    //         default:
    //             break;
    //     }
    //     event.preventDefault();
    // }

    // public async load(endpoint: string, accessToken ?: string, me ?: string) {
    //     // Determine if this game is:
    //     // - local game
    //     // - new game *WITH* friendID in url
    //     // - existing game
    //     const path = window.location.pathname;
    //     const query = window.location.search;
    //     const queryString = QueryStringParser.parse(query);

    //     this.endpoint = endpoint;
    //     if (accessToken) {
    //         this.accessToken = accessToken;
    //     }

    //     this.initialize();

    //     this.start = new Date().toISOString();

    //     if (path.indexOf("/local") !== -1) {
    //         console.log("local game");
    //         this.isLocalGame = true;

    //         this.ai.trackEvent({
    //             name: "Play-NewGame", properties: {
    //                 isLocalGame: true,
    //             }
    //         });

    //         this.game = new MyChessGame();

    //         const json = Database.get<string>(DatabaseFields.GAMES_LOCAL_GAME_STATE);
    //         if (json) {
    //             // Try to load game state from previously stored state
    //             try {
    //                 this.game = JSON.parse(json) as MyChessGame;
    //                 console.log(this.game);

    //                 this.currentMoveNumber = this.makeNumberOfMoves(this.game, this.game.moves.length);
    //             } catch (error) {
    //                 console.log(error);
    //                 this.ai.trackException({ exception: error });

    //                 this.game = new MyChessGame();
    //             }
    //         }
    //     }
    //     else {
    //         this.isLocalGame = false;
    //         if (me) {
    //             this.me = me;
    //         }

    //         if (path.indexOf("/new") !== -1) {

    //             this.ai.trackEvent({
    //                 name: "Play-NewGame", properties: {
    //                     isLocalGame: false,
    //                 }
    //             });

    //             console.log("new game");
    //             this.isNewGame = true;
    //             const friendIDParameter = queryString.get("friendID");
    //             if (friendIDParameter) {
    //                 this.friendID = friendIDParameter;
    //             }
    //             else {
    //                 throw new Error("Required parameter for friend is missing!");
    //             }
    //         }
    //         else {
    //             console.log("existing game");
    //             if (!accessToken) {
    //                 console.log("skip fetching game before accessToken is available")
    //             }
    //             else {
    //                 const gameID = path.substring(path.lastIndexOf("/") + 1);
    //                 const state = queryString.get("state") ?? "";

    //                 try {
    //                     const request: RequestInit = {
    //                         method: "GET",
    //                         headers: {
    //                             "Accept": "application/json",
    //                             "Authorization": "Bearer " + this.accessToken
    //                         }
    //                     };
    //                     const response = await fetch(this.endpoint + `/api/games/${gameID}?state=${state}`, request);
    //                     this.game = await response.json() as MyChessGame;
    //                     console.log(this.game);

    //                     // let animatedMoves = Math.min(3, this.game.moves.length);
    //                     // let moves = this.game.moves.length - animatedMoves;
    //                     this.currentMoveNumber = this.makeNumberOfMoves(this.game, this.game.moves.length);
    //                     // setTimeout(() => {
    //                     //     this.animateNextMove();
    //                     // }, 1000);
    //                 }
    //                 catch (error) {
    //                     console.log(error);
    //                     this.ai.trackException({ exception: error });

    //                     // $("#errorText").text(textStatus);
    //                     // $("#errorDialog").dialog();
    //                 }
    //             }
    //         }
    //     }

    //     this.loadImages();
    // }

    // public async postNewGame(game: MyChessGame) {
    //     const request: RequestInit = {
    //         method: "POST",
    //         body: JSON.stringify(game),
    //         headers: {
    //             "Accept": "application/json",
    //             "Authorization": "Bearer " + this.accessToken
    //         }
    //     };

    //     this.showSpinner(true);
    //     try {

    //         const response = await fetch(this.endpoint + "/api/games", request);
    //         this.game = await response.json() as MyChessGame;
    //         console.log(this.game);

    //         document.location.href = `/play/${this.game.id}?state=${GameStateFilter.WAITING_FOR_OPPONENT}`;
    //     } catch (error) {
    //         console.log(error);
    //         this.ai.trackException({ exception: error });

    //         const errorMessage = error.errorMessage ? error.errorMessage : "Unable to create new game";
    //         this.showError(errorMessage);
    //         this.undo();
    //     }
    //     this.showSpinner(false);
    // }

    // public async postMove(move: MyChessGameMove) {
    //     const request: RequestInit = {
    //         method: "POST",
    //         body: JSON.stringify(move),
    //         headers: {
    //             "Accept": "application/json",
    //             "Authorization": "Bearer " + this.accessToken
    //         }
    //     };

    //     this.showSpinner(true);
    //     try {
    //         const response = await fetch(this.endpoint + `/api/games/${this.game.id}/moves`, request);
    //         if (response.ok) {
    //             console.log("Move submitted successfully");
    //             this.game.moves.push(move);
    //             this.currentMoveNumber++;
    //             this.makeNumberOfMoves(this.game, this.game.moves.length);
    //         }
    //         else {
    //             throw new Error("Could not make move submit!")
    //         }
    //     } catch (error) {
    //         console.log(error);
    //         this.ai.trackException({ exception: error });

    //         const errorMessage = error.errorMessage ? error.errorMessage : "Unable to post your move";
    //         this.showError(errorMessage);
    //         this.undo();
    //     }
    //     this.showSpinner(false);
    // }

    // public confirmMove = (): void => {
    //     console.log("move confirmed");
    //     this.showError("");
    //     this.showConfirmationDialog(false);
    //     this.showPromotionDialog(false);

    //     if (this.isLocalGame) {
    //         const lastMove = this.getLastMoveAsString();
    //         const lastPromotion = this.getLastMovePromotionAsString();
    //         if (!lastMove) {
    //             console.log("no last move available");
    //             return;
    //         }

    //         const move = new MyChessGameMove()
    //         move.move = lastMove;
    //         move.promotion = lastPromotion;
    //         move.comment = "";
    //         move.start = this.start;
    //         move.end = new Date().toISOString();

    //         this.game.moves.push(move);
    //         this.currentMoveNumber++;

    //         Database.set(DatabaseFields.GAMES_LOCAL_GAME_STATE, JSON.stringify(this.game));
    //         this.start = new Date().toISOString();
    //     }
    //     this.showCommentDialog(!this.isLocalGame);
    //     this.showGameNameDialog(!this.isLocalGame && this.isNewGame);
    //     this.isDialogOpen = !this.isLocalGame;
    // }

    // public confirmComment = (): void => {
    //     console.log("comment confirmed");

    //     const commentElement = document.getElementById("comment") as HTMLTextAreaElement;
    //     const content = commentElement?.value;
    //     const comment = content ? content : "";

    //     const lastMove = this.getLastMoveAsString();
    //     const lastPromotion = this.getLastMovePromotionAsString();
    //     if (!lastMove) {
    //         console.log("no last move available");

    //         this.ai.trackEvent({
    //             name: "Play-Errors", properties: {
    //                 type: "NoLastMoveAvailable",
    //             }
    //         });

    //         return;
    //     }

    //     const move = new MyChessGameMove()
    //     move.move = lastMove;
    //     move.promotion = lastPromotion;
    //     move.comment = comment;
    //     move.start = this.start;
    //     move.end = new Date().toISOString();

    //     console.log(this.isNewGame);
    //     if (this.isNewGame) {
    //         const gameNameElement = document.getElementById("gameName") as HTMLInputElement;
    //         const gameName = gameNameElement?.value;
    //         if (!gameName) {
    //             console.log("no mandatory game name provided");

    //             this.ai.trackEvent({
    //                 name: "Play-Errors", properties: {
    //                     type: "NoGameNameProvided",
    //                 }
    //             });

    //             return;
    //         }

    //         const game = new MyChessGame()
    //         game.players.black.id = this.friendID;
    //         game.name = gameName;
    //         game.moves.push(move)

    //         this.postNewGame(game);
    //     }
    //     else {
    //         this.postMove(move);
    //     }

    //     this.showGameNameDialog(false);
    //     this.showCommentDialog(false);
    //     this.isDialogOpen = false;
    // }

    // public resignGame = async () => {
    //     console.log("game resigned");

    //     this.ai.trackEvent({
    //         name: "Play-Resign"
    //     });

    //     if (this.isLocalGame) {
    //         Database.delete(DatabaseFields.GAMES_LOCAL_GAME_STATE);
    //         this.game = new MyChessGame();
    //         this.board = new ChessBoard();
    //         this.board.initialize();
    //         this.previousAvailableMoves = [];
    //         this.currentMoveNumber = 0;

    //         this.drawBoard();
    //     }
    //     else {
    //         const request: RequestInit = {
    //             method: "DELETE",
    //             headers: {
    //                 "Authorization": "Bearer " + this.accessToken
    //             }
    //         };

    //         this.showSpinner(true);
    //         try {
    //             const response = await fetch(this.endpoint + `/api/games/${this.game.id}`, request);
    //             if (response.ok) {
    //                 console.log("Game archived succesfully");
    //                 document.location.href = "/";
    //             }
    //             else {
    //                 throw new Error("Could not archive game!")
    //             }
    //         } catch (error) {
    //             console.log(error);
    //             this.ai.trackException({ exception: error });

    //             const errorMessage = error.errorMessage ? error.errorMessage : "Unable to archive the game";
    //             this.showError(errorMessage);
    //             this.undo();
    //         }
    //         this.showSpinner(false);
    //     }
    // }

    // public cancel = (): void => {
    //     console.log("cancel");

    //     this.ai.trackEvent({
    //         name: "Play-Cancel"
    //     });

    //     this.showError("");
    //     this.showConfirmationDialog(false);
    //     this.showPromotionDialog(false);
    //     this.undo();
    // }

    // private showConfirmationDialog(show: boolean) {
    //     this.waitingForConfirmation = show;
    //     let confirmationDialogElement = document.getElementById("confirmation");
    //     if (confirmationDialogElement !== null) {
    //         confirmationDialogElement.style.display = show ? "inline" : "none";
    //         this.isDialogOpen = true;
    //     }
    // }

    // private showPromotionDialog(show: boolean) {
    //     this.waitingForConfirmation = show;
    //     let promotionDialogElement = document.getElementById("promotionDialog");
    //     if (promotionDialogElement !== null) {
    //         promotionDialogElement.style.display = show ? "inline" : "none";
    //     }
    // }

    // private showGameNameDialog(show: boolean) {
    //     this.waitingForConfirmation = show;
    //     let gameNameDialogElement = document.getElementById("gameNameDialog");
    //     if (gameNameDialogElement !== null) {
    //         gameNameDialogElement.style.display = show ? "inline" : "none";
    //         if (show) {
    //             gameNameDialogElement.scrollIntoView();
    //             gameNameDialogElement.focus();
    //         }
    //     }
    // }

    // private showError(message: string) {
    //     let element = document.getElementById("error");
    //     if (element !== null) {
    //         const show = message.length > 0;
    //         element.style.display = show ? "inline" : "none";
    //         if (show) {
    //             element.innerHTML = message;
    //             element.scrollIntoView();
    //             element.focus();
    //         }
    //     }
    // }

    // private showCommentDialog(show: boolean) {
    //     this.waitingForConfirmation = show;
    //     let commentDialogElement = document.getElementById("commentDialog");
    //     if (commentDialogElement !== null) {
    //         commentDialogElement.style.display = show ? "inline" : "none";
    //         if (show) {
    //             commentDialogElement.scrollIntoView();
    //             commentDialogElement.focus();
    //         }
    //     }
    // }

    // private showSpinner(show: boolean) {
    //     let element = document.getElementById("Loading");
    //     if (element !== null) {
    //         element.style.display = show ? "inline-flex" : "none";
    //         if (show) {
    //             element.scrollIntoView();
    //             element.focus();
    //         }
    //     }
    // }

    // public changePromotion(name: string) {
    //     let promotionDialogElement = document.getElementById("promotionDialog");
    //     if (promotionDialogElement !== null) {
    //         promotionDialogElement.style.display = "none";

    //         let nodes: NodeList = document.getElementsByName(name)
    //         for (let i: number = 0; i < nodes.length; i++) {
    //             let radioElement = nodes[i] as HTMLInputElement;
    //             if (radioElement.checked === true) {
    //                 if (this.changePromotionFromString(radioElement.value)) {
    //                     this.drawBoard();
    //                 }
    //                 return;
    //             }
    //         }

    //     }
    // }

    // public undo() {
    //     let commentDialogElement = document.getElementById("commentDialog");
    //     if (commentDialogElement !== null) {
    //         commentDialogElement.style.display = "none";
    //     }

    //     this.board.undo();
    //     this.drawBoard();
    // }

    // public getLastMoveAsString(): string | undefined {
    //     return this.board.lastMove()?.getMoveString();
    // }

    // public getLastMovePromotionAsString(): string {
    //     let lastPromotion = this.board.lastMovePromotion();
    //     if (lastPromotion !== null) {
    //         return lastPromotion.piece.toString();
    //     }

    //     return "";
    // }

    // public setComment(commentText: string) {
    //     commentText = commentText !== null ? commentText : "&nbsp;";

    //     let commentElement = document.getElementById("LastComment") as HTMLDivElement;
    //     commentElement.innerHTML = commentText;
    // }

    // public setThinkTime(moveIndex: number, thinkTime: number) {
    //     let thinkTimeElement = document.getElementById("ThinkTime") as HTMLDivElement;

    //     if (thinkTime === -1) {
    //         thinkTimeElement.innerText = "";
    //         return;
    //     }

    //     let minutes = 0;
    //     let seconds = thinkTime / 1000;
    //     if (seconds > 60) {
    //         minutes = Math.floor(seconds / 60);
    //         seconds = Math.floor(seconds % 60);
    //     }
    //     else {
    //         seconds = Math.floor(seconds);
    //     }

    //     if (minutes > 0) {
    //         thinkTimeElement.innerText = "Move " + moveIndex + " think time was " + minutes + " minutes and " + seconds + " seconds.";
    //     }
    //     else {
    //         thinkTimeElement.innerText = "Move " + moveIndex + " think time was " + seconds + " seconds.";
    //     }
    // }

    // public setBoardStatus(currentMoveIndex: number, moves: number) {
    //     let statusElement = document.getElementById("status") as HTMLDivElement;
    //     let status = this.board.GetBoardState();
    //     let gameStatusMessage = "";

    //     console.log("currentMoveIndex: " + currentMoveIndex + ", moves: " + moves);
    //     if (currentMoveIndex !== moves) {
    //         gameStatusMessage = "Move ";
    //         gameStatusMessage += currentMoveIndex;
    //     }

    //     switch (status) {
    //         case ChessBoardState.StaleMate:
    //             gameStatusMessage = "Stalemate";
    //             break;

    //         case ChessBoardState.Check:
    //             gameStatusMessage = "Check " + gameStatusMessage;
    //             break;

    //         case ChessBoardState.CheckMate:
    //             gameStatusMessage = "Checkmate!";
    //             break;

    //         default:
    //             gameStatusMessage += "&nbsp;"
    //             break;
    //     }

    //     statusElement.innerHTML = gameStatusMessage;
    // }

    // private moveHistory(direction: number) {
    //     this.currentMoveNumber += direction;
    //     console.log("direction: " + direction);
    //     console.log(this.game);
    //     console.log("currentMoveNumber: " + this.currentMoveNumber);

    //     if (this.currentMoveNumber < 1) {
    //         this.currentMoveNumber = 1;
    //     }
    //     else if (this.currentMoveNumber > this.game.moves.length) {
    //         this.currentMoveNumber = this.game.moves.length;
    //     }
    //     this.makeNumberOfMoves(this.game, this.currentMoveNumber);
    // }

    // public firstMove() {
    //     console.log("to first move");
    //     this.ai.trackEvent({
    //         name: "Play-MoveHistory", properties: {
    //             type: "First",
    //         }
    //     });

    //     this.moveHistory(-999999);
    // }

    // public previousMove() {
    //     console.log("previous move");
    //     this.ai.trackEvent({
    //         name: "Play-MoveHistory", properties: {
    //             type: "Previous",
    //         }
    //     });

    //     this.moveHistory(-1);
    // }

    // public nextMove() {
    //     console.log("next move");
    //     this.ai.trackEvent({
    //         name: "Play-MoveHistory", properties: {
    //             type: "Next",
    //         }
    //     });

    //     this.moveHistory(1);
    // }

    // public lastMove() {
    //     console.log("to last move");
    //     this.ai.trackEvent({
    //         name: "Play-MoveHistory", properties: {
    //             type: "Last",
    //         }
    //     });

    //     this.moveHistory(999999);
    // }

    // public animateNextMove() {
    //     console.log("animating next move");
    //     this.moveHistory(1);

    //     if (this.game.moves.length !== this.currentMoveNumber) {
    //         setTimeout(() => {
    //             this.animateNextMove();
    //         }, 1000);
    //     }
    // }

    const draw = () => {
        console.log("draw");
        let lastMove = board.lastMove();
        let lastMoveCapture = board.lastMoveCapture();
        let html = new Array<JSX.Element>();

        for (let row = 0; row < ChessBoard.BOARD_SIZE; row++) {
            const cells = new Array<JSX.Element>();
            for (let column = 0; column < ChessBoard.BOARD_SIZE; column++) {

                let piece: ChessBoardPiece = board.getPiece(column, row);

                let className = (row + column) % 2 === 0 ?
                    "lightCell" :
                    "darkCell";

                for (let i = 0; i < previousAvailableMoves.length; i++) {
                    let move: ChessMove = previousAvailableMoves[i];
                    if (row === move.to.verticalLocation &&
                        column === move.to.horizontalLocation) {
                        className += " highlightMoveAvailable";
                    }
                }

                if (lastMove !== null) {
                    if (lastMove.from.horizontalLocation === column &&
                        lastMove.from.verticalLocation === row) {
                        className += " highlightPreviousFrom";
                    }
                    else if (lastMoveCapture !== null &&
                        lastMoveCapture.from.horizontalLocation === column &&
                        lastMoveCapture.from.verticalLocation === row) {
                        className += " highlightCapture";
                    }
                    else if (lastMove.to.horizontalLocation === column &&
                        lastMove.to.verticalLocation === row) {
                        className += " highlightPreviousTo";
                    }
                }

                const key = "" + row + "-" + column;
                const image = piece.player === ChessPlayer.None ?
                    "/images/Empty.svg" :
                    "/images/" + piece.piece + piece.player + ".svg";
                const cell = <td
                    id={key}
                    key={key}
                    width={pieceSize + "px"}
                    height={pieceSize + "px"}
                    className={className}
                    onClick={(evt) => {
                        evt.preventDefault();
                        pieceSelected(evt, key);
                    }}
                >
                    <img src={image}
                        id={"" + row + "-" + column + "-image"}
                        alt=""
                        width={pieceSize + "px"}
                        height={pieceSize + "px"} />
                </td>;

                cells.push(cell);
            }
            html.push(<tr key={"" + row}>{cells}</tr>);
        }
        return html;
    }

    const getLastMoveAsString = (): string | undefined => {
        return board.lastMove()?.getMoveString();
    }

    const getLastMovePromotionAsString = (): string => {
        let lastPromotion = board.lastMovePromotion();
        if (lastPromotion !== null) {
            return lastPromotion.piece.toString();
        }

        return "";
    }

    const confirmPromotion = () => {
        const promotionSelection = document.querySelector("input[name=Promotion]:checked");
        if (promotionSelection) {
            const radio = promotionSelection as HTMLButtonElement;
            changePromotionFromString(radio.value);
        }
        confirmMove();
    }

    const confirmMove = (): void => {
        console.log("move confirmed");
        showError("");
        showConfirmationDialog(false);
        showPromotionDialog(false);

        if (isLocalGame) {
            const lastMove = getLastMoveAsString();
            const lastPromotion = getLastMovePromotionAsString();
            if (!lastMove) {
                console.log("no last move available");
                return;
            }

            const move = new MyChessGameMove()
            move.move = lastMove;
            move.promotion = lastPromotion;
            move.comment = "";
            move.start = start;
            move.end = new Date().toISOString();

            game.moves.push(move);
            setCurrentMoveNumber(e => e + 1);

            Database.set(DatabaseFields.GAMES_LOCAL_GAME_STATE, JSON.stringify(game));
            setStart(new Date().toISOString());
        }
        showCommentDialog(!isLocalGame);
        showGameNameDialog(!isLocalGame && isNewGame);
        setDialogOpen(!isLocalGame);
    }

    const confirmComment = (event: MouseEvent) => {
        event.preventDefault();

        console.log("comment confirmed");

        const commentElement = document.getElementById("comment") as HTMLTextAreaElement;
        const content = commentElement?.value;
        const comment = content ? content : "";

        const lastMove = getLastMoveAsString();
        const lastPromotion = getLastMovePromotionAsString();
        if (!lastMove) {
            console.log("no last move available");

            ai.trackEvent({
                name: "Play-Errors", properties: {
                    type: "NoLastMoveAvailable",
                }
            });

            return;
        }

        const move = new MyChessGameMove()
        move.move = lastMove;
        move.promotion = lastPromotion;
        move.comment = comment;
        move.start = start;
        move.end = new Date().toISOString();

        console.log(isNewGame);
        if (isNewGame) {
            const gameNameElement = document.getElementById("gameName") as HTMLInputElement;
            const gameName = gameNameElement?.value;
            if (!gameName) {
                console.log("no mandatory game name provided");

                ai.trackEvent({
                    name: "Play-Errors", properties: {
                        type: "NoGameNameProvided",
                    }
                });

                return;
            }

            const game = new MyChessGame()
            game.players.black.id = friendID;
            game.name = gameName;
            game.moves.push(move)

            // postNewGame(game);
        }
        else {
            // postMove(move);
        }

        // showGameNameDialog(false);
        // showCommentDialog(false);
        setDialogOpen(false);
    }

    return <>
        <div id="status"></div>
        <div id="error" className="Play-Error"></div>
        <table id="table-game"><tbody>{draw()}</tbody></table>
        <div id="confirmation" className="Play-Form">
            <button onClick={confirmMove}><span role="img" aria-label="OK">✅</span> Confirm</button>
            <button onClick={cancel}><span role="img" aria-label="Cancel">❌</span> Cancel</button>
        </div>
        <div id="promotionDialog" className="Play-Form">
            Promote pawn to:<br />
            <label>
                <input id="promotionRadioQueen" type="radio" name="Promotion" value="Queen" title="Queen" defaultChecked={true} />
                        Queen
                    </label><br />
            <label>
                <input id="promotionRadioKnight" type="radio" name="Promotion" value="Knight" title="Knight" />
                        Knight
                    </label><br />
            <label>
                <input id="promotionRadioRook" type="radio" name="Promotion" value="Rook" title="Rook" />
                        Rook
                    </label><br />
            <label>
                <input id="promotionRadioBishop" type="radio" name="Promotion" value="Bishop" title="Bishop" />
                        Bishop
                    </label><br />
            <button onClick={confirmPromotion}><span role="img" aria-label="OK">✅</span> Confirm</button>
            <button onClick={cancel}><span role="img" aria-label="Cancel">❌</span> Cancel</button>
        </div>
    </>;
}
