/**
 * UserSearchCombobox — Async Autocomplete for Task Assignee Selection
 * =====================================================================
 *
 * This component replaces the traditional static <select> tag. Instead of
 * loading all users once at mount time and rendering a dropdown list, it
 * queries the backend in real-time as the user types, showing only relevant
 * matches in a floating suggestion panel.
 *
 * HOW THE FULL AUTOCOMPLETE SEARCH LOOP WORKS (end-to-end):
 * ----------------------------------------------------------
 * Step 1 — User types into the text <input>, which updates the `query` state.
 *
 * Step 2 — The `useEffect` subscribed to `[query]` fires on every change.
 *           Before issuing an API call, it schedules a 300 ms debounce timer
 *           via `setTimeout`. If the user types another character before the
 *           300 ms window expires, the effect's cleanup function runs first
 *           and calls `clearTimeout`, cancelling the pending timer. This means
 *           only the final keystroke of a rapid burst actually triggers a
 *           network request — a classic "debounce" pattern that prevents
 *           hammering the server on every key press.
 *
 * Step 3 — After 300 ms of typing silence, the async fetch fires:
 *             GET /api/v1/users?search=<query>&limit=10
 *           Vite's dev proxy strips /api and forwards the request to the
 *           FastAPI backend at http://localhost:8000/v1/users?search=...
 *
 * Step 4 — The backend executes a case-insensitive SQL ILIKE query against
 *           both the full_name and email columns, capped at 10 rows, and
 *           returns a JSON array of UserResponse objects (no passwords).
 *
 * Step 5 — The response is stored in the `suggestions` state array. If the
 *           array is non-empty, `isOpen` is set to true, which causes the
 *           floating <ul> suggestion panel to appear directly below the input.
 *
 * Step 6 — The user clicks (or mousedowns) a suggestion in the panel:
 *           a. `query` is updated to the selected user's full_name so the
 *              input visually reflects the selection.
 *           b. `suggestions` is cleared and `isOpen` is set to false,
 *              collapsing the floating panel.
 *           c. `onSelect(user.id)` is called — this is the prop callback that
 *              bubbles the selected user's numeric database ID up to the parent
 *              TaskModal component, which stores it as `form.assignee_id`.
 *
 * Step 7 — Edge case: if the user clears the input (query becomes ""):
 *           The useEffect detects an empty string, clears suggestions, closes
 *           the panel, and calls `onSelect(null)`. This signals the parent to
 *           reset assignee_id to null so the task is saved as "Unassigned"
 *           without throwing a validation error.
 *
 * CLICK-OUTSIDE DISMISSAL:
 *   A second useEffect attaches a `mousedown` listener to `document`. When
 *   any click occurs, it checks whether the click target is inside our
 *   container `div` (tracked via `containerRef`). If the click is outside,
 *   `isOpen` is set to false. The listener is removed in the cleanup function
 *   to prevent memory leaks after the component unmounts.
 *
 * WHY `onMouseDown` INSTEAD OF `onClick` ON SUGGESTIONS?
 *   The input field's `onBlur` event fires when the user clicks away from it,
 *   and some implementations close the dropdown on blur. `onMouseDown` fires
 *   *before* the input loses focus, so the suggestion click is registered
 *   before any potential close-on-blur logic can run. Using `e.preventDefault()`
 *   inside onMouseDown also prevents the input from losing focus mid-interaction,
 *   making the selection feel instant and smooth.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/useApi';

/**
 * @param {string}   initialName  - Pre-fill the input for edit mode (the existing assignee's name).
 * @param {Function} onSelect     - Callback: receives the selected user's numeric `id`, or `null`
 *                                  when the field is cleared.
 */
export default function UserSearchCombobox({ initialName = '', onSelect }) {
  // query: the raw text currently inside the input box.
  // In edit mode this starts pre-filled with the existing assignee's name.
  const [query, setQuery] = useState(initialName);

  // suggestions: the list of User objects returned by the most recent backend search.
  // Each element has shape: { id, full_name, email }
  const [suggestions, setSuggestions] = useState([]);

  // isOpen: whether the floating suggestion panel is visible.
  // Separate from `suggestions` because we may want to hide the panel even
  // when suggestions is non-empty (e.g. immediately after a selection).
  const [isOpen, setIsOpen] = useState(false);

  // containerRef: a React ref attached to the outer <div> so we can detect
  // clicks that land outside this component and close the panel.
  const containerRef = useRef(null);

  // ─── Debounced Fetch Effect ─────────────────────────────────────────────────
  // This effect is the core of the "autocomplete search loop". It runs every
  // time the user modifies the text input (i.e., every time `query` changes).
  useEffect(() => {
    // Edge-case guard: if the input is completely blank, there is nothing to
    // search for. We clear the suggestion list, close the panel, and call
    // onSelect(null) to signal to the parent that the assignee has been removed.
    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      onSelect(null);
      return; // Exit early — no timer needed.
    }

    // Schedule the API call 300 ms in the future. If the user types another
    // character before 300 ms have elapsed, the cleanup below will cancel this
    // timer before it fires — preventing a request for an intermediate query
    // that the user has already moved past.
    const timer = setTimeout(async () => {
      try {
        // encodeURIComponent safely handles spaces, accented characters, etc.
        // The backend caps results at 10 regardless of the `limit` param,
        // but we send it explicitly to be self-documenting.
        const users = await api.get(
          `/v1/users?search=${encodeURIComponent(query.trim())}&limit=10`
        );

        setSuggestions(users);

        // Only open the panel if there are actual matches to show.
        // An empty results list means no matching users — we keep the panel
        // closed rather than rendering an empty floating box.
        setIsOpen(users.length > 0);
      } catch {
        // Network errors or auth failures should not break the form.
        // We silently swallow them: the input remains functional, the user
        // can still manually type a name (though assignee_id won't be set).
        setSuggestions([]);
        setIsOpen(false);
      }
    }, 300); // 300 ms debounce window — balances responsiveness with server load.

    // Cleanup function: React calls this before running the effect again.
    // Cancelling the previous timer is what makes the "debounce" work —
    // only the LAST scheduled fetch (after 300 ms of silence) ever executes.
    return () => clearTimeout(timer);
  }, [query]); // Dependency array: re-run whenever the input text changes.

  // ─── Click-Outside Dismissal Effect ────────────────────────────────────────
  // Attaches a global mousedown listener to close the suggestion panel when
  // the user clicks anywhere outside this component.
  useEffect(() => {
    const handleClickOutside = (e) => {
      // containerRef.current.contains(e.target) is true if the click was
      // inside our component's root div — in that case we do nothing.
      // If the click is outside, we close the panel.
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    // Attach the listener to the document so it catches clicks anywhere on the page.
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup: remove the listener when this component unmounts to prevent
    // memory leaks and stale state updates on an unmounted component.
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // Empty dependency array: run once on mount, clean up on unmount.

  // ─── Suggestion Selection Handler ──────────────────────────────────────────
  // Called when the user clicks (mousedowns) a suggestion from the panel.
  const handleSelect = (user) => {
    // Fill the visible input with the selected user's display name so the
    // form looks like a standard filled field to the user.
    setQuery(user.full_name);

    // Close the suggestion panel and clear the list — the selection is done.
    setSuggestions([]);
    setIsOpen(false);

    // Bubble the numeric database ID up to the parent TaskModal.
    // The parent stores this as `form.assignee_id`, which is included in
    // the POST/PUT payload sent to the backend when the task is saved.
    onSelect(user.id);
  };

  return (
    // `relative` positioning on the container lets the floating suggestion
    // panel use `absolute` positioning relative to this element (not the page).
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search team member by name or email..."
        autoComplete="off" // Disable browser autocomplete — we provide our own.
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Floating suggestion panel — only rendered when isOpen is true and
          there are suggestions to show. `z-50` ensures it layers on top of
          other form elements. `absolute` + `mt-1` positions it flush below
          the input without displacing surrounding layout. */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((user) => (
            <li
              key={user.id}
              onMouseDown={(e) => {
                // preventDefault stops the input from losing focus before
                // our handleSelect runs — keeps the interaction seamless.
                e.preventDefault();
                handleSelect(user);
              }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 transition-colors"
            >
              {/* Two-line display: name on top (bold), email below (muted).
                  This matches the spec's example: "Mahi (mahi@example.com)" */}
              <span className="font-medium text-gray-800 block">{user.full_name}</span>
              <span className="text-gray-400 text-xs">{user.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
