package com.dacos.config;

import javax.sql.DataSource;

import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import com.dacos.common.SearchLogInterceptor;

@Configuration
@MapperScan(basePackages = "com.dacos")
public class DatabaseConfig {

    private final DataSource dataSource;
    private final SearchLogInterceptor searchLogInterceptor;

    public DatabaseConfig(DataSource dataSource, SearchLogInterceptor searchLogInterceptor) {
        this.dataSource = dataSource;
        this.searchLogInterceptor = searchLogInterceptor;
    }

    @Bean
    public SqlSessionFactory sqlSessionFactory() throws Exception {
        SqlSessionFactoryBean factoryBean = new SqlSessionFactoryBean();
        factoryBean.setDataSource(dataSource);
        factoryBean.setMapperLocations(
            new PathMatchingResourcePatternResolver().getResources("classpath:mapper/**/*.xml")
        );
        // MyBatis 설정
        org.apache.ibatis.session.Configuration config = new org.apache.ibatis.session.Configuration();
        config.setMapUnderscoreToCamelCase(false); // 프론트 호환성 유지
        config.setDefaultFetchSize(100);
        config.setDefaultStatementTimeout(30);
        config.setJdbcTypeForNull(org.apache.ibatis.type.JdbcType.VARCHAR); // Oracle null 파라미터 오류 방지 (ORA-17004)
        factoryBean.setConfiguration(config);
        factoryBean.setPlugins(searchLogInterceptor);
        return factoryBean.getObject();
    }

    @Bean
    public SqlSessionTemplate sqlSession(SqlSessionFactory sqlSessionFactory) {
        return new SqlSessionTemplate(sqlSessionFactory);
    }
}
