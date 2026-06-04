/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Timezone - Optional IANA timezone (e.g. America/New_York) for end-of-day calculations. Leave blank to use your system timezone. */
  "timezone": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `list` command */
  export type List = ExtensionPreferences & {}
  /** Preferences accessible in the `remind` command */
  export type Remind = ExtensionPreferences & {}
  /** Preferences accessible in the `setup` command */
  export type Setup = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `list` command */
  export type List = {}
  /** Arguments passed to the `remind` command */
  export type Remind = {
  /** call mom by end of day */
  "text": string
}
  /** Arguments passed to the `setup` command */
  export type Setup = {}
}

