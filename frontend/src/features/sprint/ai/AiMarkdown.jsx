import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ gfm: true, breaks: true });

function referenceLinks(markdown) {
  return String(markdown || '').replace(
    /sprintops:\/\/(issue|sprint|documento)\/(\d+)(?:\/(\d+))?/g,
    (match, kind, first, second) => {
      if (kind === 'sprint') return `/sprint/${first}`;
      if (kind === 'documento') return `/portafolio/${first}`;
      if (kind === 'issue' && second) return `/sprint/${first}/planning/task/${second}`;
      return match;
    },
  );
}

const AiMarkdown = ({ text }) => {
  const html = useMemo(() => {
    const parsed = marked.parse(referenceLinks(text), { async: false });
    return DOMPurify.sanitize(String(parsed || ''), {
      ADD_ATTR: ['target', 'rel'],
    });
  }, [text]);

  return <div className="ai-md" dangerouslySetInnerHTML={{ __html: html }} />;
};

export default AiMarkdown;
