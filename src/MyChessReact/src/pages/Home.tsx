import React, { Component } from 'react';
import logo from "./logo.svg";
import "./Home.css";

export class Home extends Component {
    static displayName = Home.name;

    render() {
        return (
            <div>
                <header className="Home-header">
                    <img src={logo} className="Home-logo" alt="My Chess" />
                    <br />My Chess is coming. Stay tuned.
                </header>
            </div>
        );
    }
}