import {Fragment, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {useReducedMotion} from 'framer-motion';

import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';

import {SelectedTokenContext} from '../smartSearchBar/tokenActions';

import {ParseResult, Token, TokenResult} from './parser';
import {isWithinToken} from './utils';

type Props = {
  /**
   * The result from parsing the search query string
   */
  parsedQuery: ParseResult;

  /**
   * The current location of the cursror within the query. This is used to
   * highlight active tokens and trigger error tooltips.
   */
  cursorPosition?: number;
};

/**
 * Renders the parsed query with syntax highlighting.
 */
export default function HighlightQuery({parsedQuery, cursorPosition}: Props) {
  const result = renderResult(parsedQuery, cursorPosition ?? -1);

  return <Fragment>{result}</Fragment>;
}

function renderResult(result: ParseResult, cursor: number) {
  return result
    .map(t => renderToken(t, cursor))
    .map((renderedToken, i) => <Fragment key={i}>{renderedToken}</Fragment>);
}

function renderToken(token: TokenResult<Token>, cursor: number) {
  switch (token.type) {
    case Token.Spaces:
      return token.value;

    case Token.Filter:
      return <FilterToken filter={token} cursor={cursor} />;

    case Token.ValueTextList:
    case Token.ValueNumberList:
      return <ListToken token={token} cursor={cursor} />;

    case Token.ValueNumber:
      return <NumberToken token={token} />;

    case Token.ValueBoolean:
      return <Boolean>{token.text}</Boolean>;

    case Token.ValueIso8601Date:
      return <DateTime>{token.text}</DateTime>;

    case Token.LogicGroup:
      return <LogicGroup>{renderResult(token.inner, cursor)}</LogicGroup>;

    case Token.LogicBoolean:
      return <LogicBoolean>{token.value}</LogicBoolean>;

    default:
      return token.text;
  }
}

// XXX(epurkhiser): We have to animate `left` here instead of `transform` since
// inline elements cannot be transformed. The filter _must_ be inline to
// support text wrapping.
const shakeAnimation = keyframes`
  ${new Array(4)
    .fill(0)
    .map((_, i) => `${i * (100 / 4)}% { left: ${3 * (i % 2 === 0 ? 1 : -1)}px; }`)
    .join('\n')}
`;

const FilterToken = ({
  filter,
  cursor,
}: {
  cursor: number;
  filter: TokenResult<Token.Filter>;
}) => {
  const isActive = isWithinToken(filter, cursor);

  const {selection, setSelectedToken} = useContext(SelectedTokenContext);

  // This state tracks if the cursor has left the filter token. We initialize it
  // to !isActive in the case where the filter token is rendered without the
  // cursor initally being in it.
  const [hasLeft, setHasLeft] = useState(!isActive);

  // Used to trigger the shake animation when the element becomes invalid
  const filterElementRef = useRef<HTMLSpanElement>(null);

  const isSelectedRef = useRef<boolean>(false);

  // Trigger the effect when isActive changes to updated whether the cursor has
  // left the token.
  useEffect(() => {
    if (!isActive && !hasLeft) {
      setHasLeft(true);
    }
  }, [hasLeft, isActive]);

  const showInvalid = hasLeft && !!filter.invalid;
  const showTooltip = showInvalid && isActive;
  const isInteractive = !!setSelectedToken;

  const reduceMotion = useReducedMotion();

  // Trigger the shakeAnimation when showInvalid is set to true. We reset the
  // animation by clearing the style, set it to running, and re-applying the
  // animation
  useEffect(() => {
    if (!filterElementRef.current || !showInvalid || reduceMotion) {
      return;
    }

    const style = filterElementRef.current.style;

    style.animation = 'none';
    void filterElementRef.current.offsetTop;

    window.requestAnimationFrame(
      () => (style.animation = `${shakeAnimation.name} 300ms`)
    );
  }, [reduceMotion, showInvalid]);

  const isSelected = !!(selection?.filterTokenRef.current === filterElementRef.current);
  isSelectedRef.current = isSelected;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isActive && e.key === 'Alt') {
        setSelectedToken?.({
          filterToken: filter,
          filterTokenRef: filterElementRef,
        });
      }
    },
    [setSelectedToken, filter, isActive]
  );

  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (isSelectedRef.current && e.key === 'Alt') {
        setSelectedToken?.(undefined);
      }
    };

    if (isInteractive) {
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyDown, isActive, filter, isInteractive, setSelectedToken, isSelectedRef]);

  return (
    <Tooltip
      disabled={!showTooltip}
      title={filter.invalid?.reason}
      overlayStyle={{maxWidth: '350px'}}
      forceVisible
      skipWrapper
    >
      <Filter
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          setSelectedToken?.({
            filterToken: filter,
            filterTokenRef: filterElementRef,
            isClick: true,
          });
          // if (isInteractive) {
          //   e.preventDefault();
          //   /*
          //     We calculate where to place the cursor offset from the position of the filter element and the position of the click event.
          //   */
          //   const filterLeft =
          //     filterElementRef.current?.getBoundingClientRect().left ?? 0;
          //   const filterWidth = filterElementRef.current?.offsetWidth ?? 1;
          //   const percentage = (e.clientX - filterLeft) / filterWidth;
          //   const offsetWidth = filter.location.end.offset - filter.location.start.offset;
          //   const finalLocation =
          //     filter.location.start.offset + Math.round(percentage * offsetWidth);
          //   focusInputWithSelection?.(finalLocation, finalLocation);
          // }
        }}
        ref={filterElementRef}
        active={isActive}
        selected={isSelected}
        invalid={showInvalid}
        isInteractive={isInteractive}
      >
        {filter.negated && <Negation>!</Negation>}
        <KeyToken token={filter.key} negated={filter.negated} />
        {filter.operator && <Operator>{filter.operator}</Operator>}
        <Value>{renderToken(filter.value, cursor)}</Value>
      </Filter>
    </Tooltip>
  );
};

const KeyToken = ({
  token,
  negated,
}: {
  token: TokenResult<Token.KeySimple | Token.KeyAggregate | Token.KeyExplicitTag>;
  negated?: boolean;
}) => {
  let value: React.ReactNode = token.text;

  if (token.type === Token.KeyExplicitTag) {
    value = (
      <ExplicitKey prefix={token.prefix}>
        {token.key.quoted ? `"${token.key.value}"` : token.key.value}
      </ExplicitKey>
    );
  }

  return <Key negated={!!negated}>{value}:</Key>;
};

const ListToken = ({
  token,
  cursor,
}: {
  cursor: number;
  token: TokenResult<Token.ValueNumberList | Token.ValueTextList>;
}) => (
  <InList>
    {token.items.map(({value, separator}) => [
      <ListComma key="comma">{separator}</ListComma>,
      value && renderToken(value, cursor),
    ])}
  </InList>
);

const NumberToken = ({token}: {token: TokenResult<Token.ValueNumber>}) => (
  <Fragment>
    {token.value}
    <Unit>{token.unit}</Unit>
  </Fragment>
);

type FilterProps = {
  active: boolean;
  invalid: boolean;
  isInteractive: boolean;
  selected: boolean;
};

const colorType = (p: FilterProps) =>
  `${p.invalid ? 'invalid' : 'valid'}${
    p.selected ? 'Selected' : p.active ? 'Active' : ''
  }` as const;

const Filter = styled('span')<FilterProps>`
  --token-bg: ${p => p.theme.searchTokenBackground[colorType(p)]};
  --token-border-color: ${p => p.theme.searchTokenBorder[colorType(p)]};
  --token-value-color: ${p => (p.invalid ? p.theme.red300 : p.theme.blue300)};

  position: relative;
  animation-name: ${shakeAnimation};
  cursor: ${p => {
    if (p.isInteractive) {
      return p.active ? 'text' : 'pointer';
    }

    return 'auto';
  }};
  pointer-events: ${p => (p.active || p.selected ? 'none' : 'auto')};

  &:hover {
    opacity: ${p => (p.isInteractive ? '0.7' : 'inherit')};
  }
`;

const filterCss = css`
  background: var(--token-bg);
  border: 0.5px solid var(--token-border-color);
  padding: ${space(0.25)} 0;
`;

const Negation = styled('span')`
  ${filterCss};
  border-right: none;
  padding-left: 1px;
  margin-left: -2px;
  font-weight: bold;
  border-radius: 2px 0 0 2px;
  color: ${p => p.theme.red300};
`;

const Key = styled('span')<{negated: boolean}>`
  ${filterCss};
  border-right: none;
  font-weight: bold;
  ${p =>
    !p.negated
      ? css`
          border-radius: 2px 0 0 2px;
          padding-left: 1px;
          margin-left: -2px;
        `
      : css`
          border-left: none;
          margin-left: 0;
        `};
`;

const ExplicitKey = styled('span')<{prefix: string}>`
  &:before,
  &:after {
    color: ${p => p.theme.subText};
  }
  &:before {
    content: '${p => p.prefix}[';
  }
  &:after {
    content: ']';
  }
`;

const Operator = styled('span')`
  ${filterCss};
  border-left: none;
  border-right: none;
  margin: -1px 0;
  color: ${p => p.theme.pink300};
`;

const Value = styled('span')`
  ${filterCss};
  border-left: none;
  border-radius: 0 2px 2px 0;
  color: var(--token-value-color);
  margin: -1px -2px -1px 0;
  padding-right: 1px;
`;

const Unit = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.green300};
`;

const LogicBoolean = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.gray300};
`;

const Boolean = styled('span')`
  color: ${p => p.theme.pink300};
`;

const DateTime = styled('span')`
  color: ${p => p.theme.green300};
`;

const ListComma = styled('span')`
  color: ${p => p.theme.gray300};
`;

const InList = styled('span')`
  &:before {
    content: '[';
    font-weight: bold;
    color: ${p => p.theme.purple300};
  }
  &:after {
    content: ']';
    font-weight: bold;
    color: ${p => p.theme.purple300};
  }

  ${Value} {
    color: ${p => p.theme.purple300};
  }
`;

const LogicGroup = styled(({children, ...props}) => (
  <span {...props}>
    <span>(</span>
    {children}
    <span>)</span>
  </span>
))`
  > span:first-child,
  > span:last-child {
    position: relative;
    color: transparent;

    &:before {
      position: absolute;
      top: -5px;
      color: ${p => p.theme.pink300};
      font-size: 16px;
      font-weight: bold;
    }
  }

  > span:first-child:before {
    left: -3px;
    content: '(';
  }
  > span:last-child:before {
    right: -3px;
    content: ')';
  }
`;
