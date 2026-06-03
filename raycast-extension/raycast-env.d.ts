/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Linear Todos Repo Path - Absolute path to the linear-todos repository (where main.py lives). */
  "repoPath": string,
  /** uv Executable Path - Optional absolute path to the uv binary. Leave blank to auto-detect. */
  "uvPath": string,
  /** Linear API Key - Optional. Overrides ~/.config/linear-todos/config.json. Leave blank to use the CLI's existing config/env. */
  "apiKey": string,
  /** Default Team ID - Optional. Overrides the team ID from config.json. */
  "teamId": string,
  /** Default State ID - Optional. Workflow state ID for new todos. Overrides config.json. */
  "stateId": string,
  /** Done State ID - Optional. Workflow state ID used when completing todos. Overrides config.json. */
  "doneStateId": string,
  /** Timezone - Optional. e.g. America/New_York. Overrides config.json for end-of-day calculations. */
  "timezone": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `list` command */
  export type List = ExtensionPreferences & {}
  /** Preferences accessible in the `create` command */
  export type Create = ExtensionPreferences & {}
  /** Preferences accessible in the `remind` command */
  export type Remind = ExtensionPreferences & {}
  /** Preferences accessible in the `review` command */
  export type Review = ExtensionPreferences & {}
  /** Preferences accessible in the `digest` command */
  export type Digest = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `list` command */
  export type List = {}
  /** Arguments passed to the `create` command */
  export type Create = {}
  /** Arguments passed to the `remind` command */
  export type Remind = {
  /** call mom by end of day */
  "text": string
}
  /** Arguments passed to the `review` command */
  export type Review = {}
  /** Arguments passed to the `digest` command */
  export type Digest = {}
}

