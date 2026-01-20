import React from 'react';
import { Text } from '@visx/text';
import { scaleLog } from '@visx/scale';
import { Wordcloud } from '@visx/wordcloud';

interface WordcloudChartProps {
  width: number;
  height: number;
  words: WordData[];
  showControls?: boolean;
}

export interface WordData {
  text: string;
  value: number;
  type?: 'core' | 'application' | 'technical';
}

// Use only dark blue color
const darkBlue = '#3B82F6';

const fixedValueGenerator = () => 0.5;

type SpiralType = 'archimedean' | 'rectangular';

export const WordcloudChart = ({
  width,
  height,
  words,
  showControls = false
}: WordcloudChartProps) => {
  const [spiralType] = React.useState<SpiralType>('archimedean');

  if (!words || words.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const fontScale = scaleLog({
    domain: [
      Math.min(...words.map((w) => w.value)),
      Math.max(...words.map((w) => w.value))
    ],
    range: [16, 56],
  });

  const fontSizeSetter = (datum: WordData) => fontScale(datum.value);

  return (
    <div className="wordcloud">
      <Wordcloud
        words={words}
        width={width}
        height={height}
        fontSize={fontSizeSetter}
        font={'Impact, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}
        padding={8}
        spiral={spiralType}
        rotate={0}
        random={fixedValueGenerator}
      >
        {(cloudWords) =>
          cloudWords.map((w) => (
            <Text
              key={w.text}
              fill={darkBlue}
              textAnchor={'middle'}
              transform={`translate(${w.x}, ${w.y})`}
              fontSize={w.size}
              fontFamily={w.font}
              fontWeight={800}
              style={{
                opacity: 0.7 + (w.size / 112) * 0.3,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              className="word-cloud-text hover:opacity-100"
            >
              {w.text}
            </Text>
          ))
        }
      </Wordcloud>
      {showControls && (
        <div className="flex gap-4 justify-center mt-4">
          <label className="inline-flex items-center text-sm">
            Spiral type
            <select className="ml-2 p-1 border rounded">
              <option value={'archimedean'}>archimedean</option>
              <option value={'rectangular'}>rectangular</option>
            </select>
          </label>
          <label className="inline-flex items-center text-sm">
            With rotation
            <input
              type="checkbox"
              className="ml-2"
            />
          </label>
        </div>
      )}
      <style dangerouslySetInnerHTML={{
        __html: `
        .wordcloud {
          display: flex;
          flex-direction: column;
          user-select: none;
          align-items: center;
          width: 100%;
          height: 100%;
        }
        .wordcloud svg {
          cursor: pointer;
        }
        .word-cloud-text:hover {
          opacity: 1 !important;
          transform: scale(1.05);
        }
      `}} />
    </div>
  );
};
