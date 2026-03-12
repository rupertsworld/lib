import "./style.css";
import { dependencies } from "@rupertsworld/dependencies";
import { AppView } from "./app-view";
import {
  AppConfig,
  ClockService,
  DecoratedGreeterService,
  GreeterService,
} from "./services";

// Import the view first, then register services later.
dependencies.register(AppConfig, () => ({ name: "world" }));
dependencies.register(ClockService);
dependencies.register(GreeterService);
dependencies.register(DecoratedGreeterService);
dependencies.register(AppView);

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

dependencies.resolve(AppView).mount(app);
