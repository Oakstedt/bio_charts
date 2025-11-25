class Plotter {
    constructor(containerId, xSelectId, ySelectId, plotButtonId, chartTypeId) {
        this.container = document.getElementById(containerId);
        this.xSelect = document.getElementById(xSelectId);
        this.ySelect = document.getElementById(ySelectId);
        this.plotButton = document.getElementById(plotButtonId);
        this.chartTypeSelect = document.getElementById(chartTypeId);
        this.processedData = null;

        this.plotButton.addEventListener('click', () => {
            this.generatePlot();
        });
    }

    // Stores the data and populates the dropdowns
    loadData(data) {
        this.processedData = data;
        this.populateColumnSelects();
    }

    // Populates the dropdown menus with column names from the data
    populateColumnSelects() {
        if (!this.processedData || this.processedData.length === 0) {
            return;
        }

        const columnNames = Object.keys(this.processedData[0]);
        this.xSelect.innerHTML = '';
        this.ySelect.innerHTML = '';

        columnNames.forEach(col => {
            const optionX = document.createElement('option');
            optionX.value = col;
            optionX.textContent = col;
            this.xSelect.appendChild(optionX);

            const optionY = document.createElement('option');
            optionY.value = col;
            optionY.textContent = col;
            this.ySelect.appendChild(optionY);
        });

        if (columnNames.length > 1) {
            this.xSelect.value = columnNames[0];
            this.ySelect.value = columnNames[1];
        }
    }
    
    // Generates the plot based on selected columns and chart type
    generatePlot() {
        const xColumn = this.xSelect.value;
        const yColumn = this.ySelect.value;
        const chartType = this.chartTypeSelect.value;
        const statusMessage = document.getElementById('status-message');
    
        if (!this.processedData || !xColumn || !yColumn) {
            return;
        }
    
        let xData, yData;
        if (chartType === 'bar' || chartType === 'box') {
            xData = this.processedData.map(row => row['Category']);
            yData = this.processedData.map(row => row[yColumn]);
    
            if (yColumn === 'Category') {
                statusMessage.textContent = 'Error: The Category column cannot be plotted on the Y-axis for a bar or box plot. Please select a numerical column.';
                statusMessage.className = 'status-message error-message';
                return;
            }
    
            statusMessage.textContent = 'Plot generated successfully!';
            statusMessage.className = 'status-message success-message';
            
        } else {
            xData = this.processedData.map(row => row[xColumn]);
            yData = this.processedData.map(row => row[yColumn]);
    
            const isXNumeric = typeof this.processedData[0][xColumn] === 'number';
            const isYNumeric = typeof this.processedData[0][yColumn] === 'number';
    
            if (!isXNumeric || !isYNumeric) {
                statusMessage.textContent = 'Warning: Scatter plots are best for comparing two numerical variables. Try selecting numerical columns for both axes.';
                statusMessage.className = 'status-message error-message';
            } else {
                statusMessage.textContent = 'Plot generated successfully!';
                statusMessage.className = 'status-message success-message';
            }
        }
        
        let trace = null;
        let layout = {};
    
        switch (chartType) {
            case 'scatter':
                trace = this.getScatterTrace(xData, yData, xColumn, yColumn);
                layout = this.getLayout(xColumn, yColumn, 'Scatter Plot');
                break;
            case 'bar':
                trace = this.getBarTrace(xData, yData, xColumn, yColumn);
                layout = this.getLayout(xColumn, yColumn, 'Bar Chart');
                break;
            case 'box':
                trace = this.getBoxTrace(xData, yData, xColumn, yColumn);
                layout = this.getLayout(xColumn, yColumn, 'Box Plot');
                break;
            default:
                console.error("Unknown chart type");
                return;
        }
    
        Plotly.newPlot(this.container, [trace], layout, { responsive: true }).then(() => {
            this._addEditingListeners();
        });
    }

    _addEditingListeners() {
        this.container.on('plotly_doubleclick', (event) => {
            const statusMessage = document.getElementById('status-message');
            
            const isXaxisTitle = event && event.points && event.points[0].data.name && event.points[0].data.name.includes('xaxis');
            const isYaxisTitle = event && event.points && event.points[0].data.name && event.points[0].data.name.includes('yaxis');
            
            if (isXaxisTitle || isYaxisTitle) {
                const axisName = isXaxisTitle ? 'xaxis' : 'yaxis';
                const layout = this.container.layout;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = layout[axisName].title.text || '';
                input.style.position = 'absolute';
                input.style.left = event.event.clientX + 'px';
                input.style.top = event.event.clientY + 'px';
                input.style.zIndex = 1000;
                document.body.appendChild(input);

                input.focus();
                input.select();

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const newTitle = input.value;
                        const update = {};
                        update[`${axisName}.title.text`] = newTitle;
                        Plotly.relayout(this.container, update);
                        document.body.removeChild(input);
                    }
                });

                input.addEventListener('blur', () => {
                    document.body.removeChild(input);
                });
            } else {
                statusMessage.textContent = 'Please double-click on an axis title to edit it.';
                statusMessage.className = 'status-message error-message';
            }
        });
    }

    getLayout(xColumn, yColumn, title) {
        return {
            title: `${title} of ${xColumn} vs ${yColumn}`,
            xaxis: { title: xColumn },
            yaxis: { title: yColumn },
            margin: {
            b: 150, 
        }
        };
    }
    
    getScatterTrace(xData, yData, xColumn, yColumn) {
        return {
            x: xData,
            y: yData,
            mode: 'markers',
            type: 'scatter',
            name: `${xColumn} vs ${yColumn}`
        };
    }
    
    getBarTrace(xData, yData, xColumn, yColumn) {
        return {
            x: xData,
            y: yData,
            type: 'bar',
            name: `Counts for ${yColumn}`
        };
    }

    getBoxTrace(xData, yData, xColumn, yColumn) {
        return {
            x: xData,
            y: yData,
            type: 'box',
            name: `Distribution for ${yColumn}`
        };
    }
}