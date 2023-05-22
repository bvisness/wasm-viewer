export function assertUnreachable(_: never): never {
  throw new Error("reached unreachable code");
}
