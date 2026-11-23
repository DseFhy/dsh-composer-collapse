/**
 * Host half of the DSH composer-collapse plugin.
 *
 * The whole feature lives in the browser (`./client.js`): the composer is never
 * replaced, only tagged and animated. This Host half exists because a client
 * bundle is discovered through the Loader row that mounts its package, so an
 * empty, dependency-free plugin row is all the Host side needs.
 *
 * @module @dsh-local/dsh-composer-collapse
 */

/** Loader row id; the browser bundle registers under the package name instead. */
export const name = 'composer-collapse';

/** Mount the row; the browser half does the work. */
export function apply() {}
