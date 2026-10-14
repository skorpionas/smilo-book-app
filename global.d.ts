import type messages from "./messages/lt.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: "lt";
    Messages: typeof messages;
  }
}
