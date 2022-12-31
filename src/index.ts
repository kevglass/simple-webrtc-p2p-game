
import { SimpleP2PGame } from "./SimpleP2PGame";

// Moved to HTTPS, left here for anyone who wants to host the relay server without
// a certificate 

// we're using a relay server on a free host so don't have https support. This page
// can only be access on http not https
// if (window.location.protocol !== "http:") {
//     window.location.href = window.location.href.replace("https", "http");
// }

// bootstrap the game and kick it off
const axe = new SimpleP2PGame();
axe.start();