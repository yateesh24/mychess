import React from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import { Home } from './pages/Home';
import "./App.css";

function App() {
  return (
    <Router>
      <div>
        <div className="App">
          <Link to="/" className="App-link">My Chess</Link>

          <Switch>
            <Route exact path='/' component={Home} />
            <Route path="/settings">
            </Route>
          </Switch>
        </div>
      </div>
    </Router>
  );
}

export default App;
