import { dependencies } from "@rupertsworld/dependencies";
import {
  DecoratedGreeterService,
  GreeterService,
} from "./services";

export class AppView {
  readonly greeter = dependencies.resolve(GreeterService);
  readonly decoratedGreeter = dependencies.resolve(DecoratedGreeterService);

  mount(target: HTMLElement): void {
    target.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = "dependencies hello world";

    const copy = document.createElement("p");
    copy.textContent =
      "This view is imported before services are registered, then resolves them through the container. It shows both self-resolving classes and @injectable(...) constructor injection.";

    const examples = document.createElement("div");
    examples.className = "examples";

    const selfResolving = this.createExampleCard(
      "Self-resolving service",
      "GreeterService resolves AppConfig and ClockService from inside the class.",
      () => this.greeter.message(),
    );

    const decorated = this.createExampleCard(
      "Decorator-based service",
      "DecoratedGreeterService receives AppConfig and ClockService through @injectable(...).",
      () => this.decoratedGreeter.message(),
    );

    examples.append(selfResolving, decorated);

    target.append(title, copy, examples);
  }

  private createExampleCard(
    heading: string,
    description: string,
    renderMessage: () => string,
  ): HTMLElement {
    const card = document.createElement("section");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = heading;

    const copy = document.createElement("p");
    copy.textContent = description;

    const output = document.createElement("p");
    output.className = "output";

    const button = document.createElement("button");
    button.textContent = "Refresh greeting";

    const render = (): void => {
      output.textContent = renderMessage();
    };

    button.addEventListener("click", render);
    render();

    card.append(title, copy, button, output);
    return card;
  }
}
