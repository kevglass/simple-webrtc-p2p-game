// some logging functions to hide away console logs or rename them or something later
// on

export function serverLog(message: string): void {
    console.log("[NET-SERVER] " + message);
}

export function clientLog(message: string): void {
    console.log("[NET-CLIENT] " + message);
}

export function relayLog(message: string): void {
    console.log("[NET-RELAY] " + message);
}