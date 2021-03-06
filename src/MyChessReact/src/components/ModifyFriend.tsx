import React, { useEffect, useState } from "react";
import { useTypedSelector } from "../reducers";
import { ProcessState, friendUpsertRequestedEvent } from "../actions";
import { getAppInsights } from "./TelemetryService";
import { useHistory } from "react-router-dom";
import "./FriendList.css";
import { User } from "../models/User";
import { Database, DatabaseFields } from "../data/Database";
import { useDispatch } from "react-redux";

type ModifyFriendProps = {
    id?: string;
    title: string;
};

export function ModifyFriend(props: ModifyFriendProps) {
    const history = useHistory();
    const dispatch = useDispatch();

    const loginState = useTypedSelector(state => state.loginState);
    const friendUpsertState = useTypedSelector(state => state.friendUpsertState);
    const error = useTypedSelector(state => state.error);
    const errorLink = useTypedSelector(state => state.errorLink);

    const [friendName, setFriendName] = useState("");
    const [friendID, setFriendID] = useState("");

    const ai = getAppInsights();

    useEffect(() => {
        ai.trackEvent({
            name: "ModifyFriend-Load", properties: {
                identifier: props.id !== undefined,
            }
        });

        if (props.id) {
            setFriendID(props.id);

            const friends = Database.get<Array<User>>(DatabaseFields.FRIEND_LIST);
            if (friends) {
                const existingFriend = friends.find(f => f.id === props.id);
                if (existingFriend) {
                    setFriendName(existingFriend.name);
                }
            }
        }
    }, [props, ai]);

    const addFriend = () => {
        ai.trackEvent({ name: "ModifyFriend-Save" });

        console.log("save friend");
        let friend = {
            id: friendID,
            name: friendName
        };
        dispatch(friendUpsertRequestedEvent(friend));
    }

    const cancel = () => {
        ai.trackEvent({ name: "ModifyFriend-Cancel" });

        history.push("/friends");
    }

    const visible = {
    }

    const hidden = {
        display: "none",
    }

    if (loginState === ProcessState.Success) {
        return (
            <div>
                <div className="title">{props.title}</div>
                <div id="addFriend" className="Friends-Container">
                    <label className="subtitle">
                        Friend identifier<br />
                        <div className="FriendList-AddFriendSubText">
                            This is your friends identifier.<br />
                            You need this in order to connect to your friend.
                        </div>
                        <input type="text" value={friendID} className="FriendList-Identifier" onChange={e => setFriendID(e.target.value)} />
                    </label>
                    <br />
                    <label className="subtitle">
                        Friend name<br />
                        <div className="FriendList-AddFriendSubText">
                            This is your friends name.<br />
                                        This is <b>only visible to you</b>.
                                    </div>
                        <input type="text" value={friendName} onChange={e => setFriendName(e.target.value)} />
                    </label>
                    <br />
                    <button onClick={addFriend}><span role="img" aria-label={props.title}>✅</span> {props.title}</button>
                    <button onClick={cancel}><span role="img" aria-label="Cancel">❌</span> Cancel</button>
                    <div style={friendUpsertState === ProcessState.Error ? visible : hidden}>
                        <a className="FriendList-AddFriendError" href={errorLink} target="_blank" rel="noopener noreferrer">{error}</a>
                    </div>
                </div>
            </div>
        );
    }
    else {
        // Not logged in.
        return (
            <div>
                <div className="title">Add new friend</div>
                <div className="welcomeText">
                    You need to sign in to add new friends.
                </div>
            </div>
        );
    }
}
