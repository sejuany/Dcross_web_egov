package com.dacos.newcar;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;

class NewcarBuyAmountTest {
    @Test
    void skipsBlankAmountsButUpdatesZeroAndPositiveAmounts() throws Exception {
        Configuration configuration = new Configuration();
        String resource = "mapper/NewcarMapper.xml";
        try (InputStream stream = getClass().getClassLoader().getResourceAsStream(resource)) {
            new XMLMapperBuilder(stream, configuration, resource, configuration.getSqlFragments()).parse();
        }
        var statement = configuration.getMappedStatement("com.dacos.newcar.mapper.NewcarMapper.updateTrNewCar");
        for (Object amount : new Object[] { null, "", "   ", 0, "0", 71909091, "71909091" }) {
            Map<String, Object> parameters = new HashMap<>();
            parameters.put("SERVICE_ID", "test");
            parameters.put("BUY_AMT", amount);
            boolean writesAmount = statement.getBoundSql(parameters).getSql().contains("BUY_AMT =");
            assertEquals(amount != null && !amount.toString().isBlank(), writesAmount, "amount=" + amount);
        }
    }
}
