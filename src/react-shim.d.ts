declare module 'react' {
  export type ReactNode = any;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;

  export interface FC<P = {}> {
    (props: P): JSX.Element | null;
  }

  export interface MutableRefObject<T> {
    current: T;
  }

  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }

  export interface FormEvent<T = Element> {
    preventDefault(): void;
    currentTarget: T;
    target: EventTarget & T;
  }

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly unknown[]): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;

  const React: {
    StrictMode: FC<{ children?: ReactNode }>;
  };

  export default React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): JSX.Element;
  export function jsxs(type: any, props: any, key?: any): JSX.Element;
  export const Fragment: unique symbol;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: any): void;
  };
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}
