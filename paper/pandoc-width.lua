-- Pandoc Lua filter: give every image a width so high-res PNGs fit the page.
-- Usage: pandoc paper.md -o paper.pdf --pdf-engine=xelatex -V CJKmainfont="Microsoft YaHei" -L pandoc-width.lua

function Image(el)
  el.attributes.width = el.attributes.width or "0.88\\textwidth"
  return el
end
