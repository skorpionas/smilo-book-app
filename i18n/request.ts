import { getRequestConfig } from "next-intl/server";
import { TIME_ZONE } from "@/lib/time";
import messages from "@/messages/lt.json";

// Single locale for Iteration 1. Adding English later = add messages/en.json
// and pick the locale here (cookie or header); no routing changes needed.
export default getRequestConfig(async () => ({
  locale: "lt",
  messages,
  timeZone: TIME_ZONE,
  formats: {
    dateTime: {
      date: { year: "numeric", month: "2-digit", day: "2-digit" },
      time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    },
    number: {
      eur: { style: "currency", currency: "EUR" },
    },
  },
}));
