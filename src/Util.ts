export class Util {
    /**
     * Check if we're on a mobile platform
     * 
     * @returns True if we're on a mobile platform
     */
  static isMobile(): boolean {
    return Util.isIOS() || Util.isAndroid();
  }

  /**
   * Check if we're on Android
   * 
   * @returns True if we're on Android
   */
  static isAndroid(): boolean {
    return navigator.userAgent.match(/Android/i) != null;
  }

  /**
   * Check if we're on iOS
   * 
   * @returns True if we're on iOS
   */
  static isIOS(): boolean {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].indexOf(navigator.platform) >= 0
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  }

  /**
   * Utility function to make a random alpha numeric ID
   * 
   * @param length The length of the ID to create
   * @returns The alpha numeric ID
   */
  static makeId(length: number): string {
      var result           = '';
      var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      var charactersLength = characters.length;
  
      for ( var i = 0; i < length; i++ ) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
  }
}