package com.pistache.sprintops_backend.service;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.usermodel.Paragraph;
import org.apache.poi.hwpf.usermodel.Range;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;

/** Convierte un .doc binario (Word 97-2003) a HTML simple: párrafos, títulos, negrita y cursiva. */
@Service
public class LegacyDocImportService {

    public String toHtml(InputStream input) {
        try (HWPFDocument document = new HWPFDocument(input)) {
            Range range = document.getRange();
            StringBuilder html = new StringBuilder();
            for (int index = 0; index < range.numParagraphs(); index++) {
                Paragraph paragraph = range.getParagraph(index);
                String text = paragraph.text().replaceAll("[\\r\\u0007\\f]", "").trim();
                if (text.isEmpty()) continue;
                String styleName = document.getStyleSheet().getStyleDescription(paragraph.getStyleIndex()) == null
                        ? "" : String.valueOf(document.getStyleSheet().getStyleDescription(paragraph.getStyleIndex()).getName());
                String tag = styleName.toLowerCase().matches(".*(heading|título|titulo) ?1.*") ? "h1"
                        : styleName.toLowerCase().matches(".*(heading|título|titulo) ?2.*") ? "h2"
                        : styleName.toLowerCase().matches(".*(heading|título|titulo) ?3.*") ? "h3" : "p";
                StringBuilder inner = new StringBuilder();
                for (int run = 0; run < paragraph.numCharacterRuns(); run++) {
                    var characters = paragraph.getCharacterRun(run);
                    String part = escape(characters.text().replaceAll("[\\r\\u0007\\f]", ""));
                    if (part.isEmpty()) continue;
                    if (characters.isBold()) part = "<strong>" + part + "</strong>";
                    if (characters.isItalic()) part = "<em>" + part + "</em>";
                    if (characters.getUnderlineCode() != 0) part = "<u>" + part + "</u>";
                    inner.append(part);
                }
                html.append('<').append(tag).append('>').append(inner.isEmpty() ? escape(text) : inner).append("</").append(tag).append('>');
            }
            return html.isEmpty() ? "<p><br></p>" : html.toString();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer el archivo .doc.");
        }
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
