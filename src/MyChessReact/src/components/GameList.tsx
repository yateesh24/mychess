import React, { useEffect, useState } from "react";
import { MyChessGame } from "../models/MyChessGame";
import { useTypedSelector } from "../reducers";
import { ProcessState, gamesRequestedEvent } from "../actions";
import { getAppInsights } from "./TelemetryService";
import { Link, useHistory } from "react-router-dom";
import "./GameList.css";
import { Database, DatabaseFields } from "../data/Database";
import { User } from "../models/User";
import { GameStateFilter } from "../models/GameStateFilter";
import { UserSettings } from "../models/UserSettings";
import { useDispatch } from "react-redux";

export function GameList() {
    const loginState = useTypedSelector(state => state.loginState);
    const gamesState = useTypedSelector(state => state.gamesState);
    const games = useTypedSelector(state => state.games);
    const friends = useTypedSelector(state => state.friends);

    const { push } = useHistory();

    const dispatch = useDispatch();

    const ai = getAppInsights();

    const friendsStored = Database.get<User[]>(DatabaseFields.FRIEND_LIST);
    const userSettings = Database.get<UserSettings>(DatabaseFields.ME_SETTINGS);

    const [filterVisibility, setFilterVisibility] = useState(false);

    const [gameStateFilter, setGameStateFilter] = useState(GameStateFilter.WAITING_FOR_YOU.toString());
    const [title, setTitle] = useState("Games waiting for you");

    useEffect(() => {
        if (loginState !== ProcessState.Success) {
            console.log("Not logged in");
            return;
        }

        ai.trackEvent({ name: "GameList-Load" });

        dispatch(gamesRequestedEvent(gameStateFilter));
    }, [dispatch, loginState, ai, gameStateFilter]);

    const getOpponent = (game: MyChessGame) => {
        let friendID = game.players.white.id;
        if (game.players.white.id === userSettings?.id) {
            friendID = game.players.black.id;
        }
        if (friends) {
            const friend = friends.find(p => p.id === friendID);
            if (friend) {
                return friend.name;
            }
        }
        else if (friendsStored) {
            const friend = friendsStored.find(p => p.id === friendID);
            if (friend) {
                return friend.name;
            }
        }
        return "";
    }

    const getDate = (game: MyChessGame) => {
        const move = game?.moves[game?.moves.length - 1];
        if (move) {
            const now = Date.now();
            const update = Date.parse(move.end);

            let seconds = (now - update) / 1000;

            if (seconds < 60) {
                return "Now";
            }

            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            if (days > 30) {
                return `Over month ago`;
            }
            else if (days > 0) {
                return `${days} day${days > 1 ? "s" : ""} ago`
            }
            else if (hours > 0) {
                return `${hours} hour${hours > 1 ? "s" : ""} ago`
            }
            else if (minutes > 0) {
                return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
            }
            else {
                return "Now";
            }
        }
        return "";
    }

    const renderGames = (games?: MyChessGame[]) => {
        return (
            <div>
                <div className="row">
                    {games?.map(game =>
                        <Link to={{ pathname: `/play/${game?.id}?state=${gameStateFilter}` }} className="GameList-link" key={game?.id}>
                            <div className="gameTemplate">
                                <div className="nameTemplate">
                                    {game?.name}
                                </div>
                                <div className="commentTemplate">
                                    {(game?.moves.length > 0 ? game?.moves[game?.moves.length - 1].comment : "")}
                                </div>
                                <div className="opponentTemplate">
                                    {getOpponent(game)}
                                </div>
                                <div className="dateTemplate">
                                    {getDate(game)}
                                </div>
                            </div>
                        </Link>
                    )
                    }
                </div>
                <div className="subtitle">
                    Or <button onClick={addNewGame}>add new</button> game.
                </div>

            </div >
        );
    }

    const refresh = () => {
        ai.trackEvent({ name: "GameList-Refresh" });

        dispatch(gamesRequestedEvent(gameStateFilter));
    }

    const addNewGame = () => {
        ai.trackEvent({ name: "GameList-Add" });

        push("/friends");
    }

    const toggleFilterVisibility = () => {
        setFilterVisibility(e => !e);
    }

    const setFilter = (pageTitle: string, filter: string) => {
        setGameStateFilter(filter);
        setTitle(pageTitle);
        setFilterVisibility(e => !e);

        ai.trackEvent({
            name: "GameList-Filter", properties: {
                filter: filter
            }
        });
    }

    if (loginState === ProcessState.Success) {

        let contents: JSX.Element;
        switch (gamesState) {
            case ProcessState.Success:
                if (games && games?.length === 0) {
                    contents = <div className="subtitle">No games found. Click to <button onClick={refresh}>refresh</button> or
                                <button onClick={addNewGame}>add new</button> game.</div>;
                }
                else {
                    contents = renderGames(games);
                }
                break;
            case ProcessState.Error:
                contents = <div className="subtitle">Oh no! Couldn't retrieve games. Click to <button onClick={refresh}>refresh</button></div>;
                break;
            default:
                contents = <div className="subtitle"><em>Loading...</em></div>;
                break;
        }

        return (
            <div>
                <div className="GameList-titleWrapper">
                    <button className="GameList-title" onClick={toggleFilterVisibility}>{title}</button>
                    {filterVisibility ?
                        <div className="GameList-filterList">
                            Show games:<br />
                            <button className="GameList-title" onClick={() => setFilter("Games waiting for you", GameStateFilter.WAITING_FOR_YOU)}>Waiting for you</button>
                            <button className="GameList-title" onClick={() => setFilter("Games waiting for opponent", GameStateFilter.WAITING_FOR_OPPONENT)}>Waiting for opponent</button>
                            <button className="GameList-title" onClick={() => setFilter("Archive", GameStateFilter.ARCHIVE)}>Archive</button>
                        </div>
                        : <></>}
                </div>
                {contents}
            </div>
        );
    }
    else {
        // Not logged in so render blank.
        return (
            <>
            </>
        );
    }
}
