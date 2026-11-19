package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.service.AiObserveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Lectura interna del uso. No está enlazada desde la aplicación. */
@RestController
public class AiObserveController {

    @Autowired
    private AiObserveService observeService;

    @GetMapping("/api/ai/observability")
    public Map<String, Object> report(@RequestParam(required = false) String period,
                                      @RequestHeader(value = "X-SprintOps-Observe", required = false) String key) {
        return observeService.report(period, key);
    }
}
