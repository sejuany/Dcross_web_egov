package com.dacos.common;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/** DB나 Spring 컨텍스트를 실행하지 않고 실제 XML의 미해결 참조를 검사한다. */
class MapperLoadingTest {
    @Test
    void allMappersResolveIncludesBeforeLoginQuery() throws Exception {
        Configuration configuration = new Configuration();
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath:mapper/**/*.xml");
        assertTrue(resources.length > 0);
        for (Resource resource : resources) parse(configuration, resource);
        assertTrue(configuration.hasStatement("com.dacos.auth.mapper.AuthMapper.findByUserId"));
        assertTrue(configuration.getIncompleteStatements().isEmpty());
    }

    @Test
    void schedulerCanLoadBeforeItsSharedNewcarFragment() throws Exception {
        Configuration configuration = new Configuration();
        parse(configuration, new ClassPathResource("mapper/SchedulerMapper.xml"));
        parse(configuration, new ClassPathResource("mapper/NewcarMapper.xml"));
        String sql = configuration.getMappedStatement(
                "com.dacos.scheduler.mapper.SchedulerMapper.selectNewcarNumplateD2AlertTargets")
                .getBoundSql(Map.of()).getSql();
        assertTrue(sql.contains("TRUNC(TN.REGIST_DATE) BETWEEN TRUNC(SYSDATE)"));
        assertTrue(sql.contains("ROWNUM <= 2"));
        assertTrue(sql.contains("'IW'"));
        assertTrue(sql.contains("H.CODE_ID = 'HOLID'"));
        String applicationSql = configuration.getMappedStatement(
                "com.dacos.newcar.mapper.NewcarMapper.insertNewcarApplicationNumplateAlert")
                .getBoundSql(Map.of()).getSql();
        assertTrue(applicationSql.contains("TRUNC(TN.REGIST_DATE) BETWEEN TRUNC(SYSDATE)"));
    }

    private void parse(Configuration configuration, Resource resource) throws Exception {
        try (var input = resource.getInputStream()) {
            new XMLMapperBuilder(input, configuration, resource.toString(), configuration.getSqlFragments()).parse();
        }
    }
}
