import { safeFetchText } from './safeFetch';
import * as logic from '../shared/feedLogic';

export const { parseFeed, stripHtml } = logic;
export type { ParsedEntry, ParsedFeed } from '../shared/feedLogic';
export const discoverAndFetch = (input: string) => logic.discoverAndFetch(input, safeFetchText);
export const unfurl = (input: string) => logic.unfurl(input, safeFetchText);
