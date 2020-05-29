import React, { useEffect } from "react";
import { ModifyFriend } from "../components/ModifyFriend";
import "./Friends.css";
import { useParams, useRouteMatch } from "react-router-dom";

type ModifyFriendPageProps = {
    title: string;
    endpoint: string;
};

export function ModifyFriendPage(props: ModifyFriendPageProps) {
    const { id } = useParams();
    return (
        <div>
            <header className="Friends-header">
                <ModifyFriend id={id} title={props.title} endpoint={props.endpoint} />
            </header>
        </div>
    );
}
